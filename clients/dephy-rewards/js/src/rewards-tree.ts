import { MerkleTree, hash } from "./merkle-tree";
import { Address, getAddressCodec } from "gill";

const addressCodec = getAddressCodec()

export type RewardsNode = {
  user: Address;
  amount: bigint;
}

export function hashNode(node: RewardsNode): Buffer {
  const amountBuffer = Buffer.alloc(8);
  amountBuffer.writeBigUInt64LE(node.amount, 0);
  return hash(Buffer.from(addressCodec.encode(node.user)), amountBuffer);
}

export function buildRewardsTree(nodes: RewardsNode[]) {
  const depth = Math.ceil(Math.log2(nodes.length))
  return MerkleTree.sparseMerkleTreeFromLeaves(nodes.map(hashNode), depth)
}
