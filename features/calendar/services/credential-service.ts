import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Stores calendar credentials in the Supabase Vault.
<<<<<<< ours
 *
 * Note: These credentials pass through the application layer (Node.js) because
 * the CalDAV integration uses the `tsdav` JavaScript library, which requires
 * plaintext access to credentials to perform authentication. This differs from
 * the Instagram integration which uses Postgres-native HTTP requests.
 *
=======
 * 
 * Note: These credentials pass through the application layer (Node.js) because 
 * the CalDAV integration uses the `tsdav` JavaScript library, which requires 
 * plaintext access to credentials to perform authentication. This differs from 
 * the Instagram integration which uses Postgres-native HTTP requests.
 * 
>>>>>>> theirs
 * @param admin Supabase admin client (requires service role)
 * @param subscriptionId The ID of the calendar subscription
 * @param username Optional username for the subscription
 * @param secret The secret/password/token to store
 * @returns The ID of the created vault secret
 */
export async function storeCredentials(
  admin: SupabaseClient,
  subscriptionId: string,
  username: string | undefined,
  secret: string
): Promise<string> {
  const credentials = JSON.stringify({ username, secret });
  const secretName = `calendar-sub-${subscriptionId}`;
<<<<<<< ours

=======
  
>>>>>>> theirs
  const { error } = await admin.rpc('upsert_vault_secret', {
    p_secret_name: secretName,
    p_secret_value: credentials,
    p_secret_description: `Credentials for calendar subscription ${subscriptionId}`
  });

  if (error) {
    // Check for missing RPC function - this is a common setup issue
    if (error.message?.includes('function') && (error.message?.includes('does not exist') || error.code === 'P0001')) {
      throw new Error(`Database error: The "upsert_vault_secret" RPC is missing. Please ensure you have run the latest migrations (specifically 20250531040000_vault_functions.sql). Details: ${error.message}`);
    }
    throw error;
  }

  // Fetch the secret ID from the vault.secrets table after upserting
  const { data: secretData, error: secretError } = await admin
    .schema('vault')
    .from('secrets')
    .select('id')
    .eq('name', secretName)
    .single();

  if (secretError) throw secretError;
  return secretData.id;
}

/**
 * Reads and decrypts credentials from the Supabase Vault.
<<<<<<< ours
 *
=======
 * 
>>>>>>> theirs
 * @param admin Supabase admin client
 * @param vaultId The ID of the secret in the vault
 * @returns Object containing the decrypted username and secret
 */
export async function readCredentials(
  admin: SupabaseClient,
  vaultId: string
): Promise<{ username?: string; secret: string }> {
  const { data, error } = await admin
    .schema('vault')
    .from('decrypted_secrets')
    .select('decrypted_secret')
    .eq('id', vaultId)
    .single();

  if (error) throw error;
  if (!data) throw new Error(`Credential not found for vault ID: ${vaultId}`);
<<<<<<< ours

=======
  
>>>>>>> theirs
  try {
    return JSON.parse(data.decrypted_secret);
  } catch (e) {
    // If it's not JSON, it might be just the secret (legacy or simplified)
    return { secret: data.decrypted_secret };
  }
}

/**
 * Deletes credentials from the Supabase Vault.
<<<<<<< ours
 *
=======
 * 
>>>>>>> theirs
 * @param admin Supabase admin client
 * @param vaultId The ID of the secret to delete
 */
export async function deleteCredentials(
  admin: SupabaseClient,
  vaultId: string
): Promise<void> {
  const { error } = await admin
    .schema('vault')
    .from('secrets')
    .delete()
    .eq('id', vaultId);

  if (error) throw error;
}
