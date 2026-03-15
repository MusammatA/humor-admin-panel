// Shared frontend models for Supabase tables used by the admin UI.
export type DatabaseRow = Record<string, unknown>;

export interface Profile extends DatabaseRow {
  id: string;
  email?: string | null;
  username?: string | null;
  full_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  is_superadmin?: boolean | null;
  created_at?: string | null;
  created_datetime_utc?: string | null;
  modified_datetime_utc?: string | null;
}

export interface ImageRecord extends DatabaseRow {
  id: string;
  user_id?: string | null;
  image_url?: string | null;
  public_url?: string | null;
  cdn_url?: string | null;
  url?: string | null;
  created_at?: string | null;
}

export interface Caption extends DatabaseRow {
  id: string;
  image_id?: string | null;
  user_id?: string | null;
  topic?: string | null;
  caption_text?: string | null;
  text?: string | null;
  content?: string | null;
  caption?: string | null;
  generated_caption?: string | null;
  meme_text?: string | null;
  output?: string | null;
  created_at?: string | null;
}

export interface CaptionVote extends DatabaseRow {
  id?: string | number;
  caption_id?: string | null;
  profile_id?: string | null;
  user_id?: string | null;
  vote_value?: number | null;
  created_at?: string | null;
}

export interface CaptionRequest extends DatabaseRow {
  id: string | number;
  profile_id?: string | null;
  image_id?: string | null;
  created_datetime_utc?: string | null;
}

export interface CaptionExample extends DatabaseRow {
  id?: string | number;
  image_description: string;
  caption: string;
  explanation: string;
  priority?: number | null;
  image_id?: string | null;
  created_datetime_utc?: string | null;
  modified_datetime_utc?: string | null;
}

export interface HumorFlavor extends DatabaseRow {
  id?: string;
  name?: string | null;
  label?: string | null;
  flavor?: string | null;
  title?: string | null;
  created_at?: string | null;
}

export interface HumorStep extends DatabaseRow {
  id?: string;
  flavor_id?: string | null;
  humor_flavor_id?: string | null;
  flavor?: string | null;
  flavor_name?: string | null;
  title?: string | null;
  step?: string | null;
  step_text?: string | null;
  description?: string | null;
  instruction?: string | null;
  order_index?: number | string | null;
  step_order?: number | string | null;
  position?: number | string | null;
  created_at?: string | null;
}

export interface HumorMix extends DatabaseRow {
  id: string;
  val: unknown;
  name?: string | null;
  label?: string | null;
  humor_flavor_id?: string | number | null;
  caption_count?: number | null;
  created_at?: string | null;
  created_datetime_utc?: string | null;
}

export interface LLMProvider extends DatabaseRow {
  id?: string;
  name: string;
  api_key_required?: boolean | null;
  base_url?: string | null;
  provider?: string | null;
  slug?: string | null;
  created_at?: string | null;
}

export interface LLMModel extends DatabaseRow {
  id?: string | number;
  name: string;
  llm_provider_id?: string | number | null;
  provider_model_id?: string | null;
  is_temperature_supported?: boolean | null;
  created_at?: string | null;
  created_datetime_utc?: string | null;
}

export interface AllowedDomain extends DatabaseRow {
  id?: string;
  domain: string;
  host?: string | null;
  apex_domain?: string | null;
  created_at?: string | null;
  created_datetime_utc?: string | null;
}

export interface Term extends DatabaseRow {
  id?: string | number;
  term: string;
  definition: string;
  example: string;
  priority?: number | null;
  term_type_id?: number | null;
  created_datetime_utc?: string | null;
  modified_datetime_utc?: string | null;
}

export interface WhitelistedEmail extends DatabaseRow {
  id?: string;
  email?: string | null;
  Superadmin?: boolean | null;
  created_at?: string | null;
  created_datetime_utc?: string | null;
}

export interface LLMPromptChain extends DatabaseRow {
  id: string | number;
  caption_request_id?: string | number | null;
  created_at?: string | null;
  created_datetime_utc?: string | null;
}

export interface LLMResponse extends DatabaseRow {
  id: string;
  llm_model_response?: string | null;
  processing_time_seconds?: number | null;
  llm_model_id?: string | number | null;
  profile_id?: string | null;
  caption_request_id?: string | number | null;
  llm_system_prompt?: string | null;
  llm_user_prompt?: string | null;
  llm_temperature?: number | string | null;
  humor_flavor_id?: string | number | null;
  llm_prompt_chain_id?: string | number | null;
  humor_flavor_step_id?: string | number | null;
  created_datetime_utc?: string | null;
}
