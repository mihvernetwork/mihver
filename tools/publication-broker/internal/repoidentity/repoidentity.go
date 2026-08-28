// Package repoidentity implements ONE versioned, conservative validator for a MIHVER repository
// identity (owner, repository name, and git remote name), shared by every Broker package that
// either (a) decides whether a request is well-formed (internal/protocol's Envelope/Receipt
// validation) or (b) uses an owner/repo/remote_name value to build something with real effect (a
// Git remote URL in internal/gitremote, or a GitHub REST API path in internal/githubapp). Sharing
// one validator means those two concerns can never silently drift apart -- a value internal/protocol
// accepted is guaranteed to still be accepted (and mean the same thing) wherever it is later used.
//
// This package deliberately does NOT attempt to replicate GitHub's full, actual owner/repository
// naming rules (which are more permissive in some respects and have their own history of edge
// cases). It implements a conservative SUBSET: every string this package accepts is guaranteed safe
// to embed in exactly one Git remote URL path segment and exactly one GitHub REST API path segment
// without altering the number of path segments, without traversing directories, and without
// injecting a query/fragment/authority component -- at the cost of also rejecting some values a real
// GitHub owner/repository name could legally have. That tradeoff is intentional: this validator
// guards a privileged code path, and false rejection is categorically cheaper than false acceptance
// here.
//
// # Accepted owner
//
//   - 1-39 ASCII characters
//   - alphanumeric (A-Z, a-z, 0-9) or hyphen ('-') only
//   - begins and ends with an alphanumeric character (so a bare "-" or a leading/trailing hyphen is
//     rejected)
//   - no two consecutive hyphens
//
// # Accepted repository name
//
//   - 1-100 ASCII characters
//   - alphanumeric, '.', '_', or '-' only
//   - not exactly "." or ".." (both are directory-traversal/self-reference tokens)
//   - not composed only of '.' characters (e.g. "..." -- also rejected, for the same reason, even
//     though it is not literally ".." )
//
// # Categorically rejected in both owner and repository name
//
// Independent of the character-class rules above (i.e. these are rejected even if some future
// revision of the class rules were to loosen), this package always rejects: '/', '\\', '%', '?',
// '#', '@', ':', any ASCII control character (including NUL), any non-ASCII byte (which rules out
// Unicode path/separator lookalikes such as U+2044 FRACTION SLASH or U+FF0F FULLWIDTH SOLIDUS --
// those are non-ASCII and so already excluded by the "ASCII characters only" rule, called out
// explicitly here because confusable-separator injection is exactly the attack this package exists
// to close), and leading or trailing whitespace. In practice the character-class allowlists above
// already exclude all of these; they are listed again here as an explicit contract, not as a
// separate implementation.
//
// # Accepted remote_name
//
// remote_name is validated separately and more narrowly: it is used only as a literal Git remote
// identifier (conceptually, the <name> in `git remote add <name> <url>`), never as a path segment,
// so it does not need the owner/repository character-class rules. It must be non-empty, contain no
// path separator ('/' or '\\'), no whitespace or control character, no ref-like special character
// ('~', '^', ':', '?', '*', '[', '@'), and must not begin with '-' (which would risk being
// interpreted as a command-line option by a tool invoked with the remote name as a bare argument).
package repoidentity

import (
	"errors"
	"fmt"
)

const (
	maxOwnerLen = 39
	maxNameLen  = 100
)

// Sentinel errors -- stable and errors.Is-checkable, never a bare fmt.Errorf a caller has to
// substring-match. Validate/New always wraps one of these with %w for additional context.
var (
	// ErrInvalidOwner is returned when the owner value fails any rule documented on this package.
	ErrInvalidOwner = errors.New("repoidentity: invalid repository owner")
	// ErrInvalidRepositoryName is returned when the repository name value fails any rule documented
	// on this package.
	ErrInvalidRepositoryName = errors.New("repoidentity: invalid repository name")
	// ErrInvalidRemoteName is returned when the remote_name value fails the narrower remote-name
	// rules documented on this package.
	ErrInvalidRemoteName = errors.New("repoidentity: invalid git remote name")
)

// Identity is a validated MIHVER repository owner/name pair. The zero value is NOT a validated
// identity -- it is indistinguishable from an owner="" name="" that would itself be rejected by
// Validate, so any caller that constructs an Identity directly (bypassing New/Validate) rather than
// receiving one from this package must not assume it is safe; every downstream consumer in this
// module (internal/gitremote, internal/githubapp) re-validates defensively rather than trusting a
// bare Identity value's provenance.
type Identity struct {
	Owner string
	Name  string
}

// isAlnum reports whether b is an ASCII letter or digit.
func isAlnum(b byte) bool {
	return (b >= 'a' && b <= 'z') || (b >= 'A' && b <= 'Z') || (b >= '0' && b <= '9')
}

// ValidateOwner checks owner alone against the owner rules documented on this package.
func ValidateOwner(owner string) error {
	if owner == "" {
		return fmt.Errorf("%w: empty", ErrInvalidOwner)
	}
	if len(owner) > maxOwnerLen {
		return fmt.Errorf("%w: exceeds %d characters", ErrInvalidOwner, maxOwnerLen)
	}
	if !isAlnum(owner[0]) || !isAlnum(owner[len(owner)-1]) {
		return fmt.Errorf("%w: must begin and end with an alphanumeric character", ErrInvalidOwner)
	}
	prevHyphen := false
	for i := 0; i < len(owner); i++ {
		b := owner[i]
		if b >= 0x80 {
			return fmt.Errorf("%w: contains a non-ASCII byte", ErrInvalidOwner)
		}
		if isAlnum(b) {
			prevHyphen = false
			continue
		}
		if b == '-' {
			if prevHyphen {
				return fmt.Errorf("%w: contains consecutive hyphens", ErrInvalidOwner)
			}
			prevHyphen = true
			continue
		}
		return fmt.Errorf("%w: contains disallowed character %q", ErrInvalidOwner, b)
	}
	return nil
}

// ValidateName checks the repository name alone against the repository-name rules documented on
// this package.
func ValidateName(name string) error {
	if name == "" {
		return fmt.Errorf("%w: empty", ErrInvalidRepositoryName)
	}
	if len(name) > maxNameLen {
		return fmt.Errorf("%w: exceeds %d characters", ErrInvalidRepositoryName, maxNameLen)
	}
	allDots := true
	for i := 0; i < len(name); i++ {
		b := name[i]
		if b >= 0x80 {
			return fmt.Errorf("%w: contains a non-ASCII byte", ErrInvalidRepositoryName)
		}
		if b != '.' {
			allDots = false
		}
		if isAlnum(b) || b == '.' || b == '_' || b == '-' {
			continue
		}
		return fmt.Errorf("%w: contains disallowed character %q", ErrInvalidRepositoryName, b)
	}
	if allDots {
		return fmt.Errorf("%w: must not be composed only of '.' characters", ErrInvalidRepositoryName)
	}
	return nil
}

// Validate checks owner and name together and, only if both are valid, returns a populated
// Identity. On failure it returns a zero Identity and an error wrapping ErrInvalidOwner or
// ErrInvalidRepositoryName (checkable via errors.Is), never a bare/unwrapped error.
func Validate(owner, name string) (Identity, error) {
	if err := ValidateOwner(owner); err != nil {
		return Identity{}, err
	}
	if err := ValidateName(name); err != nil {
		return Identity{}, err
	}
	return Identity{Owner: owner, Name: name}, nil
}

// New is an alias for Validate, provided as the conventional smart-constructor name.
func New(owner, name string) (Identity, error) {
	return Validate(owner, name)
}

// ValidateRemoteName checks a remote_name value against the narrower remote-name rules documented
// on this package: it proves the value is safe to use as a literal git remote identifier (e.g. the
// <name> in `git remote add <name> <url>`) -- it does NOT replicate the owner/name character-class
// allowlists, since remote_name is never used as a URL/API path segment in this module.
func ValidateRemoteName(remoteName string) error {
	if remoteName == "" {
		return fmt.Errorf("%w: empty", ErrInvalidRemoteName)
	}
	if remoteName[0] == '-' {
		return fmt.Errorf("%w: must not start with '-' (would risk being interpreted as an option)", ErrInvalidRemoteName)
	}
	for i := 0; i < len(remoteName); i++ {
		b := remoteName[i]
		if b >= 0x80 {
			return fmt.Errorf("%w: contains a non-ASCII byte", ErrInvalidRemoteName)
		}
		if b <= 0x20 || b == 0x7f {
			return fmt.Errorf("%w: contains whitespace or a control character", ErrInvalidRemoteName)
		}
		switch b {
		case '/', '\\', '~', '^', ':', '?', '*', '[', '@':
			return fmt.Errorf("%w: contains disallowed character %q", ErrInvalidRemoteName, b)
		}
	}
	return nil
}
