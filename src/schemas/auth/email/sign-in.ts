import { z } from 'zod'
import { OTP_LENGTH } from '~/lib/auth'
import { normaliseEmail } from '~/utils/zod'

export const emailSignInSchema = z.object({
  // TODO: Re-enable government email whitelisting after demo day
  email: normaliseEmail,
  // email: normaliseEmail.refine(isGovEmail, {
  //   message: 'Please sign in with an .gov.sg email address.',
  // }),
})

export const emailVerifyOtpSchema = emailSignInSchema.extend({
  token: z
    .string()
    .trim()
    .min(1, 'OTP is required.')
    .length(OTP_LENGTH, `Please enter a ${OTP_LENGTH} character OTP.`),
})
