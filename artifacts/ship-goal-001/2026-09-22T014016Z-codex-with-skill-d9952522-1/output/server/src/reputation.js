function buildReputation(loans) {
  const byAddress = {};

  for (const loan of loans) {
    const borrower = loan.borrowerAddress.toLowerCase();
    const stats = byAddress[borrower] || {
      address: loan.borrowerAddress,
      completedLoans: 0,
      lateReturns: 0,
      activeLoans: 0,
      score: 0
    };

    if (loan.status === "returned") {
      stats.completedLoans += 1;
      if ((loan.lateDays || 0) > 0) {
        stats.lateReturns += 1;
      }
    }

    if (loan.status === "active") {
      stats.activeLoans += 1;
    }

    byAddress[borrower] = stats;
  }

  for (const stats of Object.values(byAddress)) {
    const onTime = stats.completedLoans - stats.lateReturns;
    stats.score = onTime * 12 - stats.lateReturns * 20 + stats.completedLoans * 2 - stats.activeLoans * 3;
  }

  return byAddress;
}

function memberWithReputation(member, reputation) {
  const stats = reputation[member.address.toLowerCase()] || {
    address: member.address,
    completedLoans: 0,
    lateReturns: 0,
    activeLoans: 0,
    score: 0
  };

  return {
    ...member,
    reputation: stats
  };
}

module.exports = {
  buildReputation,
  memberWithReputation
};
