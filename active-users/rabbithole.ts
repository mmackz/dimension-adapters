import { FetchOptions, SimpleAdapter } from "../adapters/types";
import { CHAIN } from "../helpers/chains";

// Rabbithole time-based incentives. Both contracts are deployed with CREATE2 at
// the same address on every chain (https://github.com/boostxyz/boost-protocol).
//
//   TimeBasedIncentiveManager - pays out campaign rewards and referral rewards.
//   TBIForwarder              - deposits into an incentivized position on the
//                               user's behalf when they deposit through the app.
//
// Every event carries the address that earned or deposited, which is not the
// transaction sender: claims are often submitted by a batcher or relayer.
const MANAGER = "0x81d1Bb513197F4e23E9676B4f3aaBC7de89b54D0";
const FORWARDER = "0x7A33Bcf7588190e3123235db746339045207Bb93";

const activityEvents = [
  {
    target: MANAGER,
    userField: "user",
    eventAbi: "event Claimed(uint256 indexed campaignId, address indexed user, uint256 amount, uint256 cumulativeAmount)",
  },
  {
    target: MANAGER,
    userField: "referrer",
    eventAbi: "event ReferralClaimed(uint256 indexed campaignId, address indexed referrer, uint256 amount)",
  },
  {
    target: FORWARDER,
    userField: "user",
    eventAbi: "event Deposit(address indexed user, address indexed target, address indexed asset, uint256 amount)",
  },
  {
    target: FORWARDER,
    userField: "user",
    eventAbi: "event LedgerDeposit(address indexed user, address indexed ledger, uint256 marketKey, uint256 amount)",
  },
  {
    target: FORWARDER,
    userField: "user",
    eventAbi: "event UniswapV4LPDeposit(address indexed user, address indexed positionManager, bytes32 indexed poolId, uint128 liquidity, uint256 amount0, uint256 amount1)",
  },
] as const;

const fetch = async (options: FetchOptions) => {
  const logsByEvent = await Promise.all(
    activityEvents.map(({ target, eventAbi }) =>
      options.getLogs({ targets: [target], eventAbi, onlyArgs: false })
    )
  );

  const users = new Set<string>();
  const transactions = new Set<string>();

  logsByEvent.forEach((logs, eventIndex) => {
    const { userField } = activityEvents[eventIndex];
    logs.forEach((log: any) => {
      const user = log.args?.[userField];
      if (typeof user === "string") users.add(user.toLowerCase());
      if (typeof log.transactionHash === "string") transactions.add(log.transactionHash.toLowerCase());
    });
  });

  return {
    dailyActiveUsers: users.size,
    dailyTransactionsCount: transactions.size,
  };
};

const adapter: SimpleAdapter = {
  version: 1,
  fetch,
  adapter: {
    [CHAIN.WC]: { start: "2026-02-10" },
    [CHAIN.BASE]: { start: "2026-03-27" },
    [CHAIN.ETHEREUM]: { start: "2026-06-17" },
    [CHAIN.OPTIMISM]: { start: "2026-07-10" },
    [CHAIN.ARBITRUM]: { start: "2026-07-19" },
    [CHAIN.ROBINHOOD]: { start: "2026-09-12" },
  },
  methodology:
    "Counts unique addresses that claimed campaign rewards (Claimed) or referral rewards (ReferralClaimed) from the Rabbithole TimeBasedIncentiveManager, or deposited into an incentivized position through the Rabbithole TBIForwarder (Deposit, LedgerDeposit, UniswapV4LPDeposit), and the transactions those actions occurred in. The address counted is the one on the event, not the transaction sender, since claims are often batched or relayed. Holders who accrue rewards from a position opened elsewhere are counted on the days they claim.",
};

export default adapter;
