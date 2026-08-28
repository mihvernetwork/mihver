package repoidentity

import (
	"errors"
	"strings"
	"testing"
)

func TestValidate_OrdinaryValidPair_Accepted(t *testing.T) {
	id, err := Validate("mihvernetwork", "mihver")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if id.Owner != "mihvernetwork" || id.Name != "mihver" {
		t.Fatalf("unexpected identity: %+v", id)
	}
}

func TestValidate_EmptyOwner_Rejected(t *testing.T) {
	_, err := Validate("", "mihver")
	if !errors.Is(err, ErrInvalidOwner) {
		t.Fatalf("expected ErrInvalidOwner, got %v", err)
	}
}

func TestValidate_EmptyRepo_Rejected(t *testing.T) {
	_, err := Validate("mihvernetwork", "")
	if !errors.Is(err, ErrInvalidRepositoryName) {
		t.Fatalf("expected ErrInvalidRepositoryName, got %v", err)
	}
}

func TestValidate_OwnerContainingSlash_Rejected(t *testing.T) {
	_, err := Validate("expected/other-owner", "target")
	if !errors.Is(err, ErrInvalidOwner) {
		t.Fatalf("expected ErrInvalidOwner, got %v", err)
	}
}

func TestValidate_OwnerContainingDotDotSlash_Rejected(t *testing.T) {
	_, err := Validate("expected/../../other-owner", "target")
	if !errors.Is(err, ErrInvalidOwner) {
		t.Fatalf("expected ErrInvalidOwner, got %v", err)
	}
}

func TestValidate_OwnerContainingLiteralPercentEncodedSlash_Rejected(t *testing.T) {
	// Literal text "%2F" in the raw string -- not a URL to decode.
	_, err := Validate("owner%2Fname", "target")
	if !errors.Is(err, ErrInvalidOwner) {
		t.Fatalf("expected ErrInvalidOwner, got %v", err)
	}
}

func TestValidate_OwnerContainingBackslash_Rejected(t *testing.T) {
	_, err := Validate(`owner\name`, "target")
	if !errors.Is(err, ErrInvalidOwner) {
		t.Fatalf("expected ErrInvalidOwner, got %v", err)
	}
}

func TestValidate_OwnerContainingSpecialChars_Rejected(t *testing.T) {
	for _, owner := range []string{"owner?", "owner#name", "owner@name", "owner:name"} {
		if _, err := Validate(owner, "target"); !errors.Is(err, ErrInvalidOwner) {
			t.Fatalf("owner %q: expected ErrInvalidOwner, got %v", owner, err)
		}
	}
}

func TestValidate_RepoNameDot_Rejected(t *testing.T) {
	_, err := Validate("mihvernetwork", ".")
	if !errors.Is(err, ErrInvalidRepositoryName) {
		t.Fatalf("expected ErrInvalidRepositoryName, got %v", err)
	}
}

func TestValidate_RepoNameDotDot_Rejected(t *testing.T) {
	_, err := Validate("mihvernetwork", "..")
	if !errors.Is(err, ErrInvalidRepositoryName) {
		t.Fatalf("expected ErrInvalidRepositoryName, got %v", err)
	}
}

func TestValidate_RepoNameOnlyDots_Rejected(t *testing.T) {
	_, err := Validate("mihvernetwork", "...")
	if !errors.Is(err, ErrInvalidRepositoryName) {
		t.Fatalf("expected ErrInvalidRepositoryName, got %v", err)
	}
}

func TestValidate_UnicodeConfusableSeparators_Rejected(t *testing.T) {
	cases := []string{
		"owner⁄name", // U+2044 FRACTION SLASH
		"owner／name", // U+FF0F FULLWIDTH SOLIDUS
	}
	for _, owner := range cases {
		if _, err := Validate(owner, "target"); !errors.Is(err, ErrInvalidOwner) {
			t.Fatalf("owner %q: expected ErrInvalidOwner, got %v", owner, err)
		}
	}
	for _, name := range cases {
		if _, err := Validate("mihvernetwork", name); !errors.Is(err, ErrInvalidRepositoryName) {
			t.Fatalf("name %q: expected ErrInvalidRepositoryName, got %v", name, err)
		}
	}
}

func TestValidate_MaxLength_Accepted(t *testing.T) {
	owner := strings.Repeat("a", maxOwnerLen)
	name := strings.Repeat("a", maxNameLen)
	if _, err := Validate(owner, name); err != nil {
		t.Fatalf("unexpected error at max length: %v", err)
	}
}

func TestValidate_OverMaxLength_Rejected(t *testing.T) {
	owner := strings.Repeat("a", maxOwnerLen+1)
	if _, err := Validate(owner, "target"); !errors.Is(err, ErrInvalidOwner) {
		t.Fatalf("expected ErrInvalidOwner for over-max-length owner, got %v", err)
	}
	name := strings.Repeat("a", maxNameLen+1)
	if _, err := Validate("mihvernetwork", name); !errors.Is(err, ErrInvalidRepositoryName) {
		t.Fatalf("expected ErrInvalidRepositoryName for over-max-length name, got %v", err)
	}
}

func TestValidate_OwnerLeadingOrTrailingHyphen_Rejected(t *testing.T) {
	if _, err := Validate("-owner", "target"); !errors.Is(err, ErrInvalidOwner) {
		t.Fatalf("expected ErrInvalidOwner for leading hyphen, got %v", err)
	}
	if _, err := Validate("owner-", "target"); !errors.Is(err, ErrInvalidOwner) {
		t.Fatalf("expected ErrInvalidOwner for trailing hyphen, got %v", err)
	}
}

func TestValidate_OwnerConsecutiveHyphens_Rejected(t *testing.T) {
	if _, err := Validate("own--er", "target"); !errors.Is(err, ErrInvalidOwner) {
		t.Fatalf("expected ErrInvalidOwner for consecutive hyphens, got %v", err)
	}
}

func TestValidate_LeadingOrTrailingWhitespace_Rejected(t *testing.T) {
	if _, err := Validate(" mihvernetwork", "target"); !errors.Is(err, ErrInvalidOwner) {
		t.Fatalf("expected ErrInvalidOwner for leading whitespace, got %v", err)
	}
	if _, err := Validate("mihvernetwork ", "target"); !errors.Is(err, ErrInvalidOwner) {
		t.Fatalf("expected ErrInvalidOwner for trailing whitespace, got %v", err)
	}
	if _, err := Validate("mihvernetwork", " target"); !errors.Is(err, ErrInvalidRepositoryName) {
		t.Fatalf("expected ErrInvalidRepositoryName for leading whitespace, got %v", err)
	}
}

func TestValidate_ControlCharacters_Rejected(t *testing.T) {
	if _, err := Validate("owner\x00name", "target"); !errors.Is(err, ErrInvalidOwner) {
		t.Fatalf("expected ErrInvalidOwner for embedded NUL, got %v", err)
	}
}

func TestNew_IsAliasForValidate(t *testing.T) {
	id, err := New("mihvernetwork", "mihver")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if id.Owner != "mihvernetwork" || id.Name != "mihver" {
		t.Fatalf("unexpected identity: %+v", id)
	}
}

// --- remote_name -----------------------------------------------------------------------------

func TestValidateRemoteName_Ordinary_Accepted(t *testing.T) {
	if err := ValidateRemoteName("origin"); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestValidateRemoteName_Empty_Rejected(t *testing.T) {
	if err := ValidateRemoteName(""); !errors.Is(err, ErrInvalidRemoteName) {
		t.Fatalf("expected ErrInvalidRemoteName, got %v", err)
	}
}

func TestValidateRemoteName_PathSeparator_Rejected(t *testing.T) {
	if err := ValidateRemoteName("a/b"); !errors.Is(err, ErrInvalidRemoteName) {
		t.Fatalf("expected ErrInvalidRemoteName for '/', got %v", err)
	}
	if err := ValidateRemoteName(`a\b`); !errors.Is(err, ErrInvalidRemoteName) {
		t.Fatalf("expected ErrInvalidRemoteName for '\\\\', got %v", err)
	}
}

func TestValidateRemoteName_LeadingHyphen_Rejected(t *testing.T) {
	if err := ValidateRemoteName("--upload-pack=evil"); !errors.Is(err, ErrInvalidRemoteName) {
		t.Fatalf("expected ErrInvalidRemoteName for option-like value, got %v", err)
	}
}

func TestValidateRemoteName_RefSpecialChars_Rejected(t *testing.T) {
	for _, name := range []string{"a:b", "a?b", "a*b", "a[b", "a^b", "a~b", "a@b"} {
		if err := ValidateRemoteName(name); !errors.Is(err, ErrInvalidRemoteName) {
			t.Fatalf("remote name %q: expected ErrInvalidRemoteName, got %v", name, err)
		}
	}
}

// remoteNameParityMatrix is THE shared literal case list for Closeout Pack A.2/A.2.1, Work Package C:
// it exists once here (checked against the real Go validator) and is duplicated verbatim in
// tests/dev/publication-remote-name-parity.test.mjs (checked against the actual AJV validation path
// for both schemas/dev/publication-envelope.schema.json and publication-receipt.schema.json). Both
// suites asserting the identical accept/reject verdict for every one of these values is what makes
// "the schema and the Go validator agree" a checked fact rather than an assertion -- see that file's
// own header comment. If this matrix changes, the Node-side copy must be updated to match, and vice
// versa.
//
// The single-character first-position cases were the confirmed defect closed in Closeout Pack A.2:
// the pre-fix schema pattern ("^[^-][^\x00-\x20\x7f/\\~^:?*\[@]*$") checked the first character only
// against '-', so a one-character "/", "\", " ", "\n", "@", ":", "?", or "[" satisfied the schema
// while ValidateRemoteName correctly rejected every one of them.
//
// The astral-plane cases (😀, 𐀀, 𝕒) are the confirmed defect closed in Closeout Pack A.2.1: Closeout
// A.2's own fix used a negated range "[^...\x7f-￿...]" to exclude non-ASCII code points, but
// JSON Schema regex engines are Unicode-CODE-POINT-aware (AJV compiles patterns with the `u` flag) --
// a code point ABOVE U+FFFF (like U+1F600 😀 or U+10000 𐀀) is simply not a member of the range
// [\x7f,￿] at all, so the negated class did not exclude it, and it was silently ACCEPTED. The
// fix replaced the negated-range approach with a POSITIVE printable-ASCII range
// ("[\x21-\x7E]+", requiring every character be in that range), which has no analogous upper-bound
// gap: an astral code point can never be a member of [\x21,\x7E] regardless of how the engine
// represents it internally, so it always fails to match.
var remoteNameParityMatrix = []struct {
	name   string
	accept bool
}{
	{"/", false},
	{"\\", false},
	{" ", false},
	{"\n", false},
	{"@", false},
	{":", false},
	{"?", false},
	{"[", false},
	{"-origin", false},
	{"a/b", false},
	{"⁄", false},    // U+2044 FRACTION SLASH -- non-ASCII path-separator confusable
	{"／", false},    // U+FF0F FULLWIDTH SOLIDUS -- non-ASCII path-separator confusable
	{"café", false}, // non-ASCII byte anywhere in the value
	{"😀", false},    // U+1F600 GRINNING FACE -- astral plane (above U+FFFF)
	{"𐀀", false},    // U+10000 LINEAR B SYLLABLE B008 A -- astral plane, the first non-BMP code point
	{"𝕒", false},    // U+1D552 MATHEMATICAL DOUBLE-STRUCK SMALL A -- astral plane
	{"origin", true},
	{"upstream", true},
	{"origin-2", true},
	{"remote.name", true},
	{"remote_name", true},
}

// TestValidateRemoteName_ParityMatrix checks every entry of remoteNameParityMatrix against the real
// Go validator -- see that variable's own doc comment for the cross-language parity story.
func TestValidateRemoteName_ParityMatrix(t *testing.T) {
	for _, c := range remoteNameParityMatrix {
		err := ValidateRemoteName(c.name)
		accepted := err == nil
		if accepted != c.accept {
			t.Fatalf("remote name %q: expected accept=%v, got accept=%v (err=%v)", c.name, c.accept, accepted, err)
		}
	}
}
