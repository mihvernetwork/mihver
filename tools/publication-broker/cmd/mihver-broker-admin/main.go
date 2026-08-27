// mihver-broker-admin is the ONLY tool that may create or revoke a PublicationGrant. It talks
// exclusively to the Broker's privileged admin Unix socket -- never the unprivileged client socket
// -- which in production is reachable only by the Broker's own dedicated OS identity (see
// docs/development/PUBLICATION_BROKER.md's macOS deployment target; this task does not provision
// that OS-level boundary, so this binary's own access control is whatever the admin socket's file
// permissions and the calling user's OS privileges already provide).
package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"net"
	"os"
	"time"
)

func main() {
	if err := run(); err != nil {
		fmt.Fprintln(os.Stderr, "mihver-broker-admin:", err)
		os.Exit(1)
	}
}

func run() error {
	if len(os.Args) < 2 {
		return fmt.Errorf("usage: mihver-broker-admin <create-grant|revoke-grant> [flags]")
	}
	sub := os.Args[1]
	fs := flag.NewFlagSet(sub, flag.ExitOnError)
	socketPath := fs.String("admin-socket", "", "path to the Broker's privileged admin Unix socket")

	switch sub {
	case "create-grant":
		requestDigest := fs.String("request-digest", "", "the exact REQUEST DIGEST printed by mihver-publish")
		owner := fs.String("owner", "", "repository owner")
		repo := fs.String("repo", "", "repository name")
		branch := fs.String("branch", "", "exact authorized branch")
		baseBranch := fs.String("base-branch", "main", "exact authorized base branch")
		baseCommit := fs.String("base-commit", "", "exact authorized base commit (40-hex)")
		ttl := fs.Duration("ttl", time.Hour, "grant expiry from now")
		fs.Parse(os.Args[2:])
		if *socketPath == "" || *requestDigest == "" || *owner == "" || *repo == "" || *branch == "" || *baseCommit == "" {
			return fmt.Errorf("create-grant requires --admin-socket --request-digest --owner --repo --branch --base-commit")
		}
		op := map[string]any{
			"op":               "create_grant",
			"request_digest":   *requestDigest,
			"repository_owner": *owner,
			"repository_name":  *repo,
			"branch":           *branch,
			"base_branch":      *baseBranch,
			"base_commit":      *baseCommit,
			"ttl_seconds":      int64(ttl.Seconds()),
		}
		return sendAdminOp(*socketPath, op)

	case "revoke-grant":
		grantID := fs.String("grant-id", "", "the grant id to revoke")
		fs.Parse(os.Args[2:])
		if *socketPath == "" || *grantID == "" {
			return fmt.Errorf("revoke-grant requires --admin-socket --grant-id")
		}
		op := map[string]any{"op": "revoke_grant", "grant_id": *grantID}
		return sendAdminOp(*socketPath, op)

	default:
		return fmt.Errorf("unknown subcommand %q", sub)
	}
}

func sendAdminOp(socketPath string, op map[string]any) error {
	conn, err := net.DialTimeout("unix", socketPath, 5*time.Second)
	if err != nil {
		return err
	}
	defer conn.Close()
	if err := json.NewEncoder(conn).Encode(op); err != nil {
		return err
	}
	var result map[string]any
	if err := json.NewDecoder(conn).Decode(&result); err != nil {
		return err
	}
	out, _ := json.MarshalIndent(result, "", "  ")
	fmt.Println(string(out))
	return nil
}
