import { z } from "zod"

export const UserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  api_key: z.string(),
  is_admin: z.number().transform(Boolean),
  created_at: z.string(),
})
export type User = z.infer<typeof UserSchema>

export const BillingLimitsSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  requests_per_minute: z.number().nullable(),
  tokens_per_day: z.number().nullable(),
  total_token_limit: z.number().nullable(),
  updated_at: z.string(),
})
export type BillingLimits = z.infer<typeof BillingLimitsSchema>

export const UsageLedgerEntrySchema = z.object({
  id: z.string(),
  user_id: z.string(),
  model: z.string(),
  prompt_tokens: z.number(),
  completion_tokens: z.number(),
  total_tokens: z.number(),
  created_at: z.string(),
})
export type UsageLedgerEntry = z.infer<typeof UsageLedgerEntrySchema>
