/**
 * This code was AUTOGENERATED using the codama library.
 * Please DO NOT EDIT THIS FILE, instead use visitors
 * to add features, then rerun codama to update it.
 *
 * @see https://github.com/codama-idl/codama
 */

import {
  assertAccountExists,
  assertAccountsExist,
  combineCodec,
  decodeAccount,
  fetchEncodedAccount,
  fetchEncodedAccounts,
  fixDecoderSize,
  fixEncoderSize,
  getAddressDecoder,
  getAddressEncoder,
  getBytesDecoder,
  getBytesEncoder,
  getStructDecoder,
  getStructEncoder,
  getU64Decoder,
  getU64Encoder,
  transformEncoder,
  type Account,
  type Address,
  type Codec,
  type Decoder,
  type EncodedAccount,
  type Encoder,
  type FetchAccountConfig,
  type FetchAccountsConfig,
  type MaybeAccount,
  type MaybeEncodedAccount,
  type ReadonlyUint8Array,
} from '@solana/kit';

export const CLAIM_STATE_DISCRIMINATOR = new Uint8Array([
  71, 73, 19, 83, 53, 228, 242, 53,
]);

export function getClaimStateDiscriminatorBytes() {
  return fixEncoderSize(getBytesEncoder(), 8).encode(CLAIM_STATE_DISCRIMINATOR);
}

export type ClaimState = {
  discriminator: ReadonlyUint8Array;
  owner: Address;
  claimedRewards: bigint;
};

export type ClaimStateArgs = {
  owner: Address;
  claimedRewards: number | bigint;
};

export function getClaimStateEncoder(): Encoder<ClaimStateArgs> {
  return transformEncoder(
    getStructEncoder([
      ['discriminator', fixEncoderSize(getBytesEncoder(), 8)],
      ['owner', getAddressEncoder()],
      ['claimedRewards', getU64Encoder()],
    ]),
    (value) => ({ ...value, discriminator: CLAIM_STATE_DISCRIMINATOR })
  );
}

export function getClaimStateDecoder(): Decoder<ClaimState> {
  return getStructDecoder([
    ['discriminator', fixDecoderSize(getBytesDecoder(), 8)],
    ['owner', getAddressDecoder()],
    ['claimedRewards', getU64Decoder()],
  ]);
}

export function getClaimStateCodec(): Codec<ClaimStateArgs, ClaimState> {
  return combineCodec(getClaimStateEncoder(), getClaimStateDecoder());
}

export function decodeClaimState<TAddress extends string = string>(
  encodedAccount: EncodedAccount<TAddress>
): Account<ClaimState, TAddress>;
export function decodeClaimState<TAddress extends string = string>(
  encodedAccount: MaybeEncodedAccount<TAddress>
): MaybeAccount<ClaimState, TAddress>;
export function decodeClaimState<TAddress extends string = string>(
  encodedAccount: EncodedAccount<TAddress> | MaybeEncodedAccount<TAddress>
): Account<ClaimState, TAddress> | MaybeAccount<ClaimState, TAddress> {
  return decodeAccount(
    encodedAccount as MaybeEncodedAccount<TAddress>,
    getClaimStateDecoder()
  );
}

export async function fetchClaimState<TAddress extends string = string>(
  rpc: Parameters<typeof fetchEncodedAccount>[0],
  address: Address<TAddress>,
  config?: FetchAccountConfig
): Promise<Account<ClaimState, TAddress>> {
  const maybeAccount = await fetchMaybeClaimState(rpc, address, config);
  assertAccountExists(maybeAccount);
  return maybeAccount;
}

export async function fetchMaybeClaimState<TAddress extends string = string>(
  rpc: Parameters<typeof fetchEncodedAccount>[0],
  address: Address<TAddress>,
  config?: FetchAccountConfig
): Promise<MaybeAccount<ClaimState, TAddress>> {
  const maybeAccount = await fetchEncodedAccount(rpc, address, config);
  return decodeClaimState(maybeAccount);
}

export async function fetchAllClaimState(
  rpc: Parameters<typeof fetchEncodedAccounts>[0],
  addresses: Array<Address>,
  config?: FetchAccountsConfig
): Promise<Account<ClaimState>[]> {
  const maybeAccounts = await fetchAllMaybeClaimState(rpc, addresses, config);
  assertAccountsExist(maybeAccounts);
  return maybeAccounts;
}

export async function fetchAllMaybeClaimState(
  rpc: Parameters<typeof fetchEncodedAccounts>[0],
  addresses: Array<Address>,
  config?: FetchAccountsConfig
): Promise<MaybeAccount<ClaimState>[]> {
  const maybeAccounts = await fetchEncodedAccounts(rpc, addresses, config);
  return maybeAccounts.map((maybeAccount) => decodeClaimState(maybeAccount));
}

export function getClaimStateSize(): number {
  return 48;
}
