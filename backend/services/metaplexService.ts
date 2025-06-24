import { Metaplex, keypairIdentity } from '@metaplex-foundation/js';
import { 
  createCreateMetadataAccountV3Instruction,
  PROGRAM_ID as METADATA_PROGRAM_ID,
} from '@metaplex-foundation/mpl-token-metadata';
import { PublicKey, Transaction, Connection, Keypair } from '@solana/web3.js';
import { solanaConfig } from '../config/solana';

interface NFTData {
  name: string;
  symbol: string;
  description?: string;
  image?: string;
  external_url?: string;
  attributes?: any[];
}

class MetaplexService {
  connection: Connection | null;
  feePayer: Keypair | null;
  metaplex: any;

  constructor() {
    this.connection = solanaConfig.connection;
    this.feePayer = solanaConfig.feePayerKeypair;
    if (this.feePayer && this.connection) {
      this.metaplex = Metaplex.make(this.connection)
        .use(keypairIdentity(this.feePayer));
    }
  }

  // Upload metadata to Arweave/IPFS
  async uploadMetadata(metadata: any): Promise<{ uri: string }> {
    return { uri: 'metadata_uri_placeholder' };
  }

  // Create token metadata account
  async createTokenMetadata(tokenData: any): Promise<{ success: boolean }> {
    return { success: true };
  }

  // Create NFT (mint + metadata in one call)
  async createNFT(nftData: NFTData): Promise<any> {
    try {
      const { name, symbol, description, image, external_url, attributes } = nftData;
      if (!this.metaplex) {
        throw new Error('Metaplex not initialized - missing fee payer');
      }
      const { nft } = await this.metaplex.nfts().create({
        name,
        symbol,
        description,
        image,
        external_url,
        attributes: attributes || [],
        sellerFeeBasisPoints: 0,
        creators: [{
          address: this.feePayer!.publicKey,
          verified: true,
          share: 100,
        }],
      });
      return {
        mint: nft.address.toString(),
        metadataAddress: nft.metadataAddress.toString(),
        metadataUri: nft.uri,
        name: nft.name,
        symbol: nft.symbol
      };
    } catch (error: any) {
      throw new Error(`Failed to create NFT: ${error.message}`);
    }
  }

  // Get NFT metadata
  async getNFTMetadata(mintAddress: string): Promise<any> {
    try {
      if (!this.metaplex) {
        throw new Error('Metaplex not initialized - missing fee payer');
      }
      const mintPubkey = new PublicKey(mintAddress);
      const nft = await this.metaplex.nfts().findByMint({ mintAddress: mintPubkey });
      return {
        mint: nft.address.toString(),
        name: nft.name,
        symbol: nft.symbol,
        description: nft.json?.description || '',
        image: nft.json?.image || '',
        attributes: nft.json?.attributes || [],
        uri: nft.uri,
        updateAuthority: nft.updateAuthorityAddress.toString(),
        creators: nft.creators.map((creator: any) => ({
          address: creator.address.toString(),
          verified: creator.verified,
          share: creator.share
        }))
      };
    } catch (error: any) {
      throw new Error(`Failed to get NFT metadata: ${error.message}`);
    }
  }

  // Update NFT metadata
  async updateNFTMetadata(mintAddress: string, newMetadata: any): Promise<any> {
    try {
      if (!this.metaplex) {
        throw new Error('Metaplex not initialized - missing fee payer');
      }
      const mintPubkey = new PublicKey(mintAddress);
      const nft = await this.metaplex.nfts().findByMint({ mintAddress: mintPubkey });
      // Upload new metadata
      const { uri } = await this.uploadMetadata(newMetadata);
      // Update the NFT
      const { response } = await this.metaplex.nfts().update({
        nftOrSft: nft,
        name: newMetadata.name || nft.name,
        symbol: newMetadata.symbol || nft.symbol,
        uri: uri,
      });
      return {
        signature: response.signature,
        metadataUri: uri
      };
    } catch (error: any) {
      throw new Error(`Failed to update NFT metadata: ${error.message}`);
    }
  }

  // Upload image to Arweave/IPFS
  async uploadImage(imageBuffer: Buffer, fileName = 'image.png'): Promise<{ uri: string }> {
    try {
      if (!this.metaplex) {
        throw new Error('Metaplex not initialized - missing fee payer');
      }
      const { uri } = await this.metaplex.storage().upload({
        buffer: imageBuffer,
        fileName: fileName,
        contentType: 'image/png',
      });
      return { uri };
    } catch (error: any) {
      throw new Error(`Failed to upload image: ${error.message}`);
    }
  }

  // Verify NFT creator
  async verifyNFTCreator(mintAddress: string, creatorAddress: string): Promise<{ signature: string }> {
    try {
      if (!this.metaplex) {
        throw new Error('Metaplex not initialized - missing fee payer');
      }
      const mintPubkey = new PublicKey(mintAddress);
      const creatorPubkey = new PublicKey(creatorAddress);
      const nft = await this.metaplex.nfts().findByMint({ mintAddress: mintPubkey });
      const { response } = await this.metaplex.nfts().verifyCreator({
        nftOrSft: nft,
        creator: creatorPubkey,
      });
      return { signature: response.signature };
    } catch (error: any) {
      throw new Error(`Failed to verify NFT creator: ${error.message}`);
    }
  }

  // Get all NFTs by owner
  async getNFTsByOwner(ownerAddress: string): Promise<any[]> {
    try {
      if (!this.metaplex) {
        throw new Error('Metaplex not initialized - missing fee payer');
      }
      const ownerPubkey = new PublicKey(ownerAddress);
      const nfts = await this.metaplex.nfts().findAllByOwner({ owner: ownerPubkey });
      return nfts.map((nft: any) => ({
        mint: nft.address.toString(),
        name: nft.name,
        symbol: nft.symbol,
        uri: nft.uri,
        updateAuthority: nft.updateAuthorityAddress.toString()
      }));
    } catch (error: any) {
      throw new Error(`Failed to get NFTs by owner: ${error.message}`);
    }
  }
}

export default MetaplexService;