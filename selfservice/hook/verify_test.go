package hook_test

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/ory/viper"

	"github.com/ory/kratos/driver/configuration"
	"github.com/ory/kratos/identity"
	"github.com/ory/kratos/internal"
	"github.com/ory/kratos/selfservice/hook"
	"github.com/ory/kratos/session"
	"github.com/ory/kratos/x"
)

func TestVerifier(t *testing.T) {
	for k, hf := range map[string]func(*hook.Verifier, *identity.Identity) error{
		"settings": func(h *hook.Verifier, i *identity.Identity) error {
			return h.ExecuteSettingsPostPersistHook(
				httptest.NewRecorder(), new(http.Request), nil, i)
		},
		"register": func(h *hook.Verifier, i *identity.Identity) error {
			return h.ExecutePostRegistrationPostPersistHook(
				httptest.NewRecorder(), new(http.Request), nil, &session.Session{ID: x.NewUUID(), Identity: i})
		},
	} {
		t.Run("name="+k, func(t *testing.T) {
			_, reg := internal.NewFastRegistryWithMocks(t)
			viper.Set(configuration.ViperKeyDefaultIdentityTraitsSchemaURL, "file://./stub/verify.schema.json")
			viper.Set(configuration.ViperKeyURLsSelfPublic, "https://www.ory.sh/")
			viper.Set(configuration.ViperKeyCourierSMTPURL, "smtp://foo@bar@dev.null/")

			i := identity.NewIdentity(configuration.DefaultIdentityTraitsSchemaID)
			i.Traits = identity.Traits(`{"emails":["foo@ory.sh","bar@ory.sh"]}`)
			require.NoError(t, reg.IdentityManager().Create(context.Background(), i))

			h := hook.NewVerifier(reg)
			require.NoError(t, hf(h, i))

			actual, err := reg.IdentityPool().FindVerifiableAddressByValue(context.Background(), identity.VerifiableAddressTypeEmail, "foo@ory.sh")
			require.NoError(t, err)
			assert.EqualValues(t, "foo@ory.sh", actual.Value)

			actual, err = reg.IdentityPool().FindVerifiableAddressByValue(context.Background(), identity.VerifiableAddressTypeEmail, "bar@ory.sh")
			require.NoError(t, err)
			assert.EqualValues(t, "bar@ory.sh", actual.Value)

			messages, err := reg.CourierPersister().NextMessages(context.Background(), 12)
			require.NoError(t, err)
			require.Len(t, messages, 2)

			assert.EqualValues(t, "foo@ory.sh", messages[0].Recipient)
			assert.EqualValues(t, "bar@ory.sh", messages[1].Recipient)
		})
	}
}
