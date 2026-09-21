import { baseApi } from './baseApi';
import type { User } from '../../types/domain';

export interface RegistrationProfilePayload {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  city: string;
}

export interface RegistrationSecurityPayload {
  registrationId: string;
  password: string;
  passwordConfirmation: string;
  acceptTerms: boolean;
  smsAlerts: boolean;
}

export interface RegistrationSession {
  registrationId: string;
  email: string;
  expiresInSeconds: number;
  demoCode?: string;
}

export interface VerificationPayload {
  registrationId: string;
  email: string;
  code: string;
}

export interface VerificationResponse {
  verified: boolean;
  user: User;
}

const useMocks = import.meta.env.VITE_USE_MOCKS !== 'false';
const demoVerificationCode = '427913';
const pause = (duration = 520) => new Promise((resolve) => window.setTimeout(resolve, duration));
let latestRegistration: RegistrationProfilePayload | null = null;

export const authApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    startRegistration: builder.mutation<RegistrationSession, RegistrationProfilePayload>({
      async queryFn(profile, _api, _extraOptions, baseQuery) {
        if (useMocks) {
          await pause();
          latestRegistration = profile;
          return {
            data: {
              registrationId: `demo-registration-${Date.now()}`,
              email: profile.email,
              expiresInSeconds: 300,
              demoCode: demoVerificationCode,
            },
          };
        }

        const response = await baseQuery({ url: '/auth/register/profile', method: 'POST', body: profile });
        if (response.error) return { error: response.error };
        return { data: response.data as RegistrationSession };
      },
    }),
    completeRegistration: builder.mutation<RegistrationSession, RegistrationSecurityPayload>({
      async queryFn(payload, _api, _extraOptions, baseQuery) {
        if (useMocks) {
          await pause(720);
          return {
            data: {
              registrationId: payload.registrationId,
              email: latestRegistration?.email || 'client@tokpa.demo',
              expiresInSeconds: 300,
              demoCode: demoVerificationCode,
            },
          };
        }

        const response = await baseQuery({ url: '/auth/register/security', method: 'POST', body: payload });
        if (response.error) return { error: response.error };
        return { data: response.data as RegistrationSession };
      },
    }),
    verifyRegistrationEmail: builder.mutation<VerificationResponse, VerificationPayload>({
      async queryFn(payload, _api, _extraOptions, baseQuery) {
        if (useMocks) {
          await pause(650);
          if (payload.code !== demoVerificationCode) {
            return { error: { status: 422, data: { message: 'Code incorrect. Vérifiez les chiffres saisis.' } } };
          }

          const name = latestRegistration ? `${latestRegistration.firstName} ${latestRegistration.lastName}` : 'Nouveau client';
          return {
            data: {
              verified: true,
              user: {
                id: 100,
                name,
                email: payload.email,
                role: 'client',
              },
            },
          };
        }

        const response = await baseQuery({ url: '/auth/email/verify', method: 'POST', body: payload });
        if (response.error) return { error: response.error };
        return { data: response.data as VerificationResponse };
      },
    }),
    resendVerificationCode: builder.mutation<RegistrationSession, Pick<VerificationPayload, 'registrationId' | 'email'>>({
      async queryFn(payload, _api, _extraOptions, baseQuery) {
        if (useMocks) {
          await pause(420);
          return {
            data: {
              registrationId: payload.registrationId,
              email: payload.email,
              expiresInSeconds: 300,
              demoCode: demoVerificationCode,
            },
          };
        }

        const response = await baseQuery({ url: '/auth/email/resend', method: 'POST', body: payload });
        if (response.error) return { error: response.error };
        return { data: response.data as RegistrationSession };
      },
    }),
  }),
});

export const {
  useStartRegistrationMutation,
  useCompleteRegistrationMutation,
  useVerifyRegistrationEmailMutation,
  useResendVerificationCodeMutation,
} = authApi;
