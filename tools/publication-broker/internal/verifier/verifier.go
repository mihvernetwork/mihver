// Package verifier implements the Broker's own independent, non-LLM re-verification of every
// remote-effect-critical fact about a commit, before any GitHub write token is ever created (V3.1-B
// Section 9). It never trusts the Local Publication Builder's or the Envelope's own assertions --
// every check here is re-derived from the actual imported Git object graph
// (internal/pkgimport), which is itself untrusted input the Broker copied into its own storage.
package verifier

import (
	"context"
	"fmt"
	"strings"

	"mihver.network/publication-broker/internal/pkgimport"
	"mihver.network/publication-broker/internal/protocol"
)

// Result is BLOCKED-shaped, mirroring the Local Publication Builder's own receipt vocabulary so the
// Broker's failure reporting stays consistent with V3.1-A's established fail-closed style.
type Result struct {
	OK     bool
	Reason string
	Detail string
}

func blocked(reason, detail string) Result { return Result{OK: false, Reason: reason, Detail: detail} }
func ok() Result                           { return Result{OK: true} }

// VerifyCommit runs every check Section 9 requires, in order, stopping at the first failure
// (fail-closed: one bad fact is enough to BLOCK regardless of how many other facts are fine).
func VerifyCommit(ctx context.Context, im *pkgimport.Imported, envelope *protocol.Envelope, receipt *protocol.Receipt) Result {
	// --- Envelope / Receipt cross-checks -----------------------------------------------------
	if envelope.ProtocolVersion != protocol.ProtocolVersion || receipt.ProtocolVersion != protocol.ProtocolVersion {
		return blocked("UNSUPPORTED_PROTOCOL_VERSION", fmt.Sprintf("envelope=%s receipt=%s", envelope.ProtocolVersion, receipt.ProtocolVersion))
	}
	if envelope.Repository != receipt.Repository {
		return blocked("REPOSITORY_IDENTITY_DISAGREEMENT", fmt.Sprintf("envelope=%+v receipt=%+v", envelope.Repository, receipt.Repository))
	}
	if envelope.Branch != receipt.Branch {
		return blocked("BRANCH_DISAGREEMENT", fmt.Sprintf("envelope=%s receipt=%s", envelope.Branch, receipt.Branch))
	}
	if envelope.BaseCommit != receipt.BaseCommit {
		return blocked("BASE_COMMIT_DISAGREEMENT", fmt.Sprintf("envelope=%s receipt=%s", envelope.BaseCommit, receipt.BaseCommit))
	}
	if receipt.Status != "COMMITTED" {
		return blocked("RECEIPT_NOT_COMMITTED", receipt.Status)
	}
	if receipt.CommitSHA == "" {
		return blocked("RECEIPT_COMMIT_SHA_MISSING", "")
	}
	if receipt.LocalHead != receipt.CommitSHA {
		return blocked("RECEIPT_LOCAL_HEAD_MISMATCH", fmt.Sprintf("local_head=%s commit_sha=%s", receipt.LocalHead, receipt.CommitSHA))
	}
	if receipt.PrePublishHead != envelope.ExpectedPrePublishHead {
		return blocked("RECEIPT_PRE_PUBLISH_HEAD_MISMATCH", fmt.Sprintf("receipt=%s envelope=%s", receipt.PrePublishHead, envelope.ExpectedPrePublishHead))
	}
	if receipt.Fingerprint != envelope.PublicationFingerprint {
		return blocked("RECEIPT_FINGERPRINT_MISMATCH", fmt.Sprintf("receipt=%s envelope=%s", receipt.Fingerprint, envelope.PublicationFingerprint))
	}

	// --- Git object checks --------------------------------------------------------------------
	if im.CommitSHA != receipt.CommitSHA {
		return blocked("IMPORTED_COMMIT_SHA_MISMATCH", fmt.Sprintf("imported=%s receipt=%s", im.CommitSHA, receipt.CommitSHA))
	}
	if envelope.Branch == "main" || envelope.Branch == "master" {
		return blocked("MAIN_BRANCH_FORBIDDEN", envelope.Branch)
	}
	if envelope.Branch == envelope.BaseBranch {
		return blocked("BRANCH_EQUALS_BASE_BRANCH", envelope.Branch)
	}

	parents, err := commitParents(ctx, im, receipt.CommitSHA)
	if err != nil {
		return blocked("COMMIT_OBJECT_UNREADABLE", err.Error())
	}
	if len(parents) != 1 {
		return blocked("UNEXPECTED_PARENT_COUNT", fmt.Sprintf("commit=%s parents=%d", receipt.CommitSHA, len(parents)))
	}
	if parents[0] != receipt.PrePublishHead {
		return blocked("UNEXPECTED_COMMIT_PARENT", fmt.Sprintf("actual=%s expected=%s", parents[0], receipt.PrePublishHead))
	}

	if _, err := im.Run(ctx, "merge-base", "--is-ancestor", envelope.BaseCommit, receipt.CommitSHA); err != nil {
		return blocked("BASE_COMMIT_NOT_ANCESTOR", err.Error())
	}

	actualMessage, err := commitMessage(ctx, im, receipt.CommitSHA)
	if err != nil {
		return blocked("COMMIT_OBJECT_UNREADABLE", err.Error())
	}
	if actualMessage != strings.TrimRight(envelope.CommitMessage, "\n") {
		return blocked("COMMIT_MESSAGE_MISMATCH", fmt.Sprintf("actual=%q expected=%q", actualMessage, envelope.CommitMessage))
	}

	// --- Changed paths: diff(pre_publish_head -> commit_sha) must equal allowed_files exactly ---
	if res := verifyChangedPaths(ctx, im, receipt.PrePublishHead, receipt.CommitSHA, envelope.AllowedFiles); !res.OK {
		return res
	}

	// --- Fingerprint: recomputed from the actual imported commit tree, independent of every
	// claim the Envelope/Receipt/manifest made about it ------------------------------------------
	fp, err := ComputeCommitTreeFingerprint(ctx, im, receipt.CommitSHA, envelope.AllowedFiles)
	if err != nil {
		return blocked("COMMIT_TREE_FINGERPRINT_UNREADABLE", err.Error())
	}
	if fp != envelope.PublicationFingerprint {
		return blocked("COMMIT_TREE_FINGERPRINT_MISMATCH", fmt.Sprintf("actual=%s expected=%s", fp, envelope.PublicationFingerprint))
	}

	return ok()
}

func commitParents(ctx context.Context, im *pkgimport.Imported, commitSHA string) ([]string, error) {
	out, err := im.Run(ctx, "cat-file", "-p", commitSHA)
	if err != nil {
		return nil, err
	}
	var parents []string
	for _, line := range strings.Split(out, "\n") {
		if line == "" {
			break // header ends at the first blank line
		}
		if strings.HasPrefix(line, "parent ") {
			parents = append(parents, strings.TrimPrefix(line, "parent "))
		}
	}
	return parents, nil
}

func commitMessage(ctx context.Context, im *pkgimport.Imported, commitSHA string) (string, error) {
	out, err := im.Run(ctx, "cat-file", "-p", commitSHA)
	if err != nil {
		return "", err
	}
	idx := strings.Index(out, "\n\n")
	if idx == -1 {
		return "", fmt.Errorf("commit object has no header/body separator")
	}
	return strings.TrimRight(out[idx+2:], "\n"), nil
}

// verifyChangedPaths requires the exact set of paths git reports as changed between preHead and
// commitSHA to equal the Envelope's allowed_files set, with status agreeing with each entry's
// declared action, and rejects any type-change (symlink/gitlink/tree substitution at an existing
// path) outright regardless of declared action.
func verifyChangedPaths(ctx context.Context, im *pkgimport.Imported, preHead, commitSHA string, allowedFiles []protocol.AllowedFile) Result {
	out, err := im.Run(ctx, "diff-tree", "--no-commit-id", "--name-status", "--no-renames", "-r", preHead, commitSHA)
	if err != nil {
		return blocked("CHANGED_PATHS_UNREADABLE", err.Error())
	}

	actual := make(map[string]string) // path -> status letter
	if strings.TrimSpace(out) != "" {
		for _, line := range strings.Split(out, "\n") {
			if line == "" {
				continue
			}
			fields := strings.SplitN(line, "\t", 2)
			if len(fields) != 2 {
				return blocked("CHANGED_PATHS_UNPARSEABLE", line)
			}
			status, path := fields[0], fields[1]
			actual[path] = status
		}
	}

	allowedByPath := make(map[string]protocol.AllowedFile, len(allowedFiles))
	for _, f := range allowedFiles {
		allowedByPath[f.Path] = f
	}

	for path, status := range actual {
		entry, isAllowed := allowedByPath[path]
		if !isAllowed {
			return blocked("EXTRA_CHANGED_PATH", path)
		}
		switch status[0] {
		case 'A', 'M':
			if entry.Action != "present" {
				return blocked("ACTION_DISAGREEMENT", fmt.Sprintf("path=%s status=%s action=%s", path, status, entry.Action))
			}
		case 'D':
			if entry.Action != "deletion" {
				return blocked("ACTION_DISAGREEMENT", fmt.Sprintf("path=%s status=%s action=%s", path, status, entry.Action))
			}
		default:
			// T (type change), C (copy), R (rename -- disabled via --no-renames but defensive),
			// or anything else: never authorized by the present/deletion model.
			return blocked("UNEXPECTED_CHANGE_TYPE", fmt.Sprintf("path=%s status=%s", path, status))
		}
	}

	for path := range allowedByPath {
		if _, present := actual[path]; !present {
			return blocked("MISSING_CHANGED_PATH", path)
		}
	}

	return ok()
}
