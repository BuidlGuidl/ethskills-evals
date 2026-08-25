/** GraphQL operations for the three application screens. */
export const FEED_QUERY = `
  query Feed($limit: Int!, $offset: Int!) {
    checkIns(limit: $limit, offset: $offset, orderBy: "timestamp", orderDirection: "desc") {
      items { member note timestamp transactionHash }
    }
  }`;

export const MEMBER_QUERY = `
  query Member($address: String!) {
    member(address: $address) { address currentStreak totalCheckIns latestCheckInAt }
  }`;

export const MONTHLY_LEADERBOARD_QUERY = `
  query MonthlyLeaderboard($month: String!, $limit: Int!) {
    monthlyMembers(where: { month: $month }, limit: $limit, orderBy: "checkIns", orderDirection: "desc") {
      items { member checkIns }
    }
  }`;
