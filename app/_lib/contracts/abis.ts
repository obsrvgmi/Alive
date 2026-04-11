/**
 * Contract ABIs for ALIVE
 * Generated from Solidity contracts
 */

export const AliveTokenFactoryABI = [
  // Events
  {
    type: 'event',
    name: 'TokenLaunched',
    inputs: [
      { name: 'token', type: 'address', indexed: true },
      { name: 'name', type: 'string', indexed: false },
      { name: 'ticker', type: 'string', indexed: false },
      { name: 'creator', type: 'address', indexed: true },
      { name: 'devBuyAmount', type: 'uint256', indexed: false },
    ],
  },
  // Read functions
  {
    type: 'function',
    name: 'bondingCurve',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'registry',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'launchFee',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  // Write functions
  {
    type: 'function',
    name: 'launch',
    inputs: [
      {
        name: 'params',
        type: 'tuple',
        components: [
          { name: 'name', type: 'string' },
          { name: 'ticker', type: 'string' },
          { name: 'metadataURI', type: 'string' },
          { name: 'feeRecipients', type: 'address[]' },
          { name: 'feeSplits', type: 'uint256[]' },
          { name: 'devBuyAmount', type: 'uint256' },
        ],
      },
    ],
    outputs: [{ name: 'token', type: 'address' }],
    stateMutability: 'payable',
  },
] as const;

export const AliveBondingCurveABI = [
  // Events
  {
    type: 'event',
    name: 'Buy',
    inputs: [
      { name: 'token', type: 'address', indexed: true },
      { name: 'buyer', type: 'address', indexed: true },
      { name: 'okbAmount', type: 'uint256', indexed: false },
      { name: 'tokenAmount', type: 'uint256', indexed: false },
      { name: 'newVitality', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'Sell',
    inputs: [
      { name: 'token', type: 'address', indexed: true },
      { name: 'seller', type: 'address', indexed: true },
      { name: 'tokenAmount', type: 'uint256', indexed: false },
      { name: 'okbAmount', type: 'uint256', indexed: false },
      { name: 'newVitality', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'Graduated',
    inputs: [
      { name: 'token', type: 'address', indexed: true },
      { name: 'lpToken', type: 'address', indexed: false },
      { name: 'liquidity', type: 'uint256', indexed: false },
    ],
  },
  // Read functions
  {
    type: 'function',
    name: 'getPrice',
    inputs: [{ name: 'token', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getReserve',
    inputs: [{ name: 'token', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getTokensOut',
    inputs: [
      { name: 'token', type: 'address' },
      { name: 'okbIn', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getOkbOut',
    inputs: [
      { name: 'token', type: 'address' },
      { name: 'tokensIn', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'isGraduated',
    inputs: [{ name: 'token', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
  },
  // Write functions
  {
    type: 'function',
    name: 'buy',
    inputs: [
      { name: 'token', type: 'address' },
      { name: 'minTokensOut', type: 'uint256' },
    ],
    outputs: [{ name: 'tokensOut', type: 'uint256' }],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    name: 'sell',
    inputs: [
      { name: 'token', type: 'address' },
      { name: 'tokenAmount', type: 'uint256' },
      { name: 'minOkbOut', type: 'uint256' },
    ],
    outputs: [{ name: 'okbOut', type: 'uint256' }],
    stateMutability: 'nonpayable',
  },
] as const;

export const AliveCharacterRegistryABI = [
  // Events
  {
    type: 'event',
    name: 'CharacterRegistered',
    inputs: [
      { name: 'token', type: 'address', indexed: true },
      { name: 'name', type: 'string', indexed: false },
      { name: 'ticker', type: 'string', indexed: false },
      { name: 'creator', type: 'address', indexed: true },
    ],
  },
  {
    type: 'event',
    name: 'VitalityUpdated',
    inputs: [
      { name: 'token', type: 'address', indexed: true },
      { name: 'oldVitality', type: 'uint256', indexed: false },
      { name: 'newVitality', type: 'uint256', indexed: false },
    ],
  },
  // Read functions
  {
    type: 'function',
    name: 'getCharacter',
    inputs: [{ name: 'token', type: 'address' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'name', type: 'string' },
          { name: 'ticker', type: 'string' },
          { name: 'metadataURI', type: 'string' },
          { name: 'creator', type: 'address' },
          { name: 'vitality', type: 'uint256' },
          { name: 'createdAt', type: 'uint256' },
          { name: 'graduated', type: 'bool' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getCurrentVitality',
    inputs: [{ name: 'token', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'isRegistered',
    inputs: [{ name: 'token', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
  },
] as const;

export const AliveBattleArenaABI = [
  // Events
  {
    type: 'event',
    name: 'BattleCreated',
    inputs: [
      { name: 'battleId', type: 'uint256', indexed: true },
      { name: 'characterA', type: 'address', indexed: true },
      { name: 'characterB', type: 'address', indexed: true },
      { name: 'startTime', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'StakePlaced',
    inputs: [
      { name: 'battleId', type: 'uint256', indexed: true },
      { name: 'staker', type: 'address', indexed: true },
      { name: 'character', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'RoundResolved',
    inputs: [
      { name: 'battleId', type: 'uint256', indexed: true },
      { name: 'roundNumber', type: 'uint256', indexed: false },
      { name: 'winner', type: 'address', indexed: true },
    ],
  },
  {
    type: 'event',
    name: 'BattleEnded',
    inputs: [
      { name: 'battleId', type: 'uint256', indexed: true },
      { name: 'winner', type: 'address', indexed: true },
      { name: 'totalPool', type: 'uint256', indexed: false },
    ],
  },
  // Read functions
  {
    type: 'function',
    name: 'getBattle',
    inputs: [{ name: 'battleId', type: 'uint256' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'characterA', type: 'address' },
          { name: 'characterB', type: 'address' },
          { name: 'poolA', type: 'uint256' },
          { name: 'poolB', type: 'uint256' },
          { name: 'startTime', type: 'uint256' },
          { name: 'currentRound', type: 'uint256' },
          { name: 'roundsWonA', type: 'uint256' },
          { name: 'roundsWonB', type: 'uint256' },
          { name: 'winner', type: 'address' },
          { name: 'ended', type: 'bool' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getStake',
    inputs: [
      { name: 'battleId', type: 'uint256' },
      { name: 'staker', type: 'address' },
    ],
    outputs: [
      { name: 'character', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'claimed', type: 'bool' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getActiveBattles',
    inputs: [],
    outputs: [{ name: '', type: 'uint256[]' }],
    stateMutability: 'view',
  },
  // Write functions
  {
    type: 'function',
    name: 'stake',
    inputs: [
      { name: 'battleId', type: 'uint256' },
      { name: 'character', type: 'address' },
    ],
    outputs: [],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    name: 'claimWinnings',
    inputs: [{ name: 'battleId', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
] as const;

export const AliveTokenABI = [
  // Standard ERC20 functions
  {
    type: 'function',
    name: 'name',
    inputs: [],
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'symbol',
    inputs: [],
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'decimals',
    inputs: [],
    outputs: [{ name: '', type: 'uint8' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'totalSupply',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'balanceOf',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'allowance',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'approve',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'transfer',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'transferFrom',
    inputs: [
      { name: 'from', type: 'address' },
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
  },
  // Events
  {
    type: 'event',
    name: 'Transfer',
    inputs: [
      { name: 'from', type: 'address', indexed: true },
      { name: 'to', type: 'address', indexed: true },
      { name: 'value', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'Approval',
    inputs: [
      { name: 'owner', type: 'address', indexed: true },
      { name: 'spender', type: 'address', indexed: true },
      { name: 'value', type: 'uint256', indexed: false },
    ],
  },
] as const;
