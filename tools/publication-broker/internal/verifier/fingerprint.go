package verifier

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"sort"
	"strings"

	"mihver.network/publication-broker/internal/pkgimport"
	"mihver.network/publication-broker/internal/protocol"
)

// blobShaAtPath returns the exact blob SHA git recorded for path in commitSHA's tree, requiring it
// be a regular file (mode 100644 or 100755) -- never a symlink (120000), gitlink/submodule
// (160000), or a tree/directory substituted at that exact path. This is independent of, and does
// not trust, anything the Local Publication Builder or the Envelope claims about the path.
func blobShaAtPath(ctx context.Context, im *pkgimport.Imported, commitSHA, path string) (sha string, present bool, err error) {
	out, err := im.Run(ctx, "ls-tree", commitSHA, "--", path)
	if err != nil {
		return "", false, fmt.Errorf("ls-tree %s: %w", path, err)
	}
	if strings.TrimSpace(out) == "" {
		return "", false, nil
	}
	lines := strings.Split(strings.TrimRight(out, "\n"), "\n")
	if len(lines) != 1 {
		return "", false, fmt.Errorf("path %q resolved to %d tree entries, expected exactly 1 (possible directory substitution)", path, len(lines))
	}
	fields := strings.Fields(lines[0])
	if len(fields) < 4 {
		return "", false, fmt.Errorf("malformed ls-tree output for %q: %q", path, lines[0])
	}
	mode, objType, sha := fields[0], fields[1], fields[2]
	if objType != "blob" {
		return "", false, fmt.Errorf("path %q is a %q object, not a regular blob (mode %s)", path, objType, mode)
	}
	if mode != "100644" && mode != "100755" {
		return "", false, fmt.Errorf("path %q has disallowed mode %s (symlink/gitlink/other)", path, mode)
	}
	return sha, true, nil
}

// ComputeCommitTreeFingerprint independently recomputes the canonical Publication Fingerprint (the
// exact V3.1-A recipe: true UTF-8 byte-order sort, `path \0 digest \n` framing, running SHA-256)
// directly from commitSHA's actual final tree -- never from anything the Envelope, Receipt, or
// package manifest claims. For each allowed entry: PRESENT uses the actual commit-tree blob SHA
// (rejecting anything that isn't a plain regular-file blob); DELETION requires the path be entirely
// absent from the final tree and uses the literal digest "ABSENT".
func ComputeCommitTreeFingerprint(ctx context.Context, im *pkgimport.Imported, commitSHA string, allowedFiles []protocol.AllowedFile) (string, error) {
	paths := make([]string, 0, len(allowedFiles))
	byPath := make(map[string]protocol.AllowedFile, len(allowedFiles))
	for _, f := range allowedFiles {
		paths = append(paths, f.Path)
		byPath[f.Path] = f
	}
	sort.Slice(paths, func(i, j int) bool {
		return bytes.Compare([]byte(paths[i]), []byte(paths[j])) < 0
	})

	h := sha256.New()
	for _, path := range paths {
		entry := byPath[path]
		sha, present, err := blobShaAtPath(ctx, im, commitSHA, path)
		if err != nil {
			return "", err
		}
		var digest string
		switch entry.Action {
		case "present":
			if !present {
				return "", fmt.Errorf("path %q declared present but absent from commit tree", path)
			}
			digest = sha
		case "deletion":
			if present {
				return "", fmt.Errorf("path %q declared deletion but still present in commit tree", path)
			}
			digest = "ABSENT"
		default:
			return "", fmt.Errorf("path %q has unknown action %q", path, entry.Action)
		}
		h.Write([]byte(path))
		h.Write([]byte{0})
		h.Write([]byte(digest))
		h.Write([]byte("\n"))
	}
	return hex.EncodeToString(h.Sum(nil)), nil
}
