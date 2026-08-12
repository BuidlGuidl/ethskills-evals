export const FEED_QUERY = `
  query Feed($first: Int!, $skip: Int!) {
    checkIns(first: $first, skip: $skip, orderBy: timestamp, orderDirection: desc) {
      id day timestamp note transactionHash member { id }
    }
    _meta { block { number } hasIndexingErrors }
  }
`;

export const MEMBER_QUERY = `
  query Member($id: Bytes!) {
    member(id: $id) { id totalCheckIns streak lastCheckInDay lastCheckInAt }
  }
`;

export const LEADERBOARD_QUERY = `
  query Leaderboard($month: String!, $first: Int!) {
    monthlyMembers(
      where: { month: $month }
      first: $first
      orderBy: checkIns
      orderDirection: desc
    ) { member checkIns lastCheckInAt }
  }
`;
