export type ParcelIdentity = {
  transaction_index: number;
  transaction_id: string;
};

export type DistrictParcels = {
  block_height: number;
  block_hash: string;
  transaction_count: number;
  parcels: ParcelIdentity[];
};

export function toDistrictParcelsV01(artifact: {
  block_height: number;
  block_hash: string;
  transaction_count: number;
  transactions: ParcelIdentity[];
}): DistrictParcels;
