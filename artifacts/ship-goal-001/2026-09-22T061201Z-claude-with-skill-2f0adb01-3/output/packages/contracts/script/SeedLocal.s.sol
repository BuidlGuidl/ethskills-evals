// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {Toolshed} from "../src/Toolshed.sol";
import {MockUSDC} from "../test/mocks/MockUSDC.sol";

/**
 * @notice Fills a local anvil deployment with a plausible neighbourhood: four members, five
 *         tools, and enough finished loans that the browse screen has real track records to
 *         sort by. Run it through `script/seed-local.sh`, which jumps the chain clock between
 *         the two stages so one loan can come back late.
 *
 *         Tool and loan ids are hardcoded (1-5), so this is meant for a freshly deployed
 *         Toolshed. Running it twice against the same deployment will act on the wrong tools.
 *
 * Env: TOOLSHED, USDC (both printed by Deploy).
 */
contract SeedLocal is Script {
    // anvil's deterministic accounts
    uint256 constant PK_STEWARD = 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80;
    uint256 constant PK_ANA = 0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d;
    uint256 constant PK_BEN = 0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a;
    uint256 constant PK_CYD = 0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6;

    Toolshed shed;
    MockUSDC usdc;

    function _load() private {
        shed = Toolshed(vm.envAddress("TOOLSHED"));
        usdc = MockUSDC(vm.envAddress("USDC"));
    }

    /// @dev Members, tools, and loans that are mid-flight when the clock jumps.
    function stage1() external {
        _load();
        address steward = vm.addr(PK_STEWARD);
        address ana = vm.addr(PK_ANA);
        address ben = vm.addr(PK_BEN);
        address cyd = vm.addr(PK_CYD);

        vm.startBroadcast(PK_STEWARD);
        address[] memory roster = new address[](4);
        roster[0] = steward;
        roster[1] = ana;
        roster[2] = ben;
        roster[3] = cyd;
        shed.admitMembers(roster);
        for (uint256 i; i < roster.length; ++i) {
            usdc.mint(roster[i], 500e6);
        }
        vm.stopBroadcast();

        // Ana lists three tools.
        vm.startBroadcast(PK_ANA);
        usdc.approve(address(shed), type(uint256).max);
        shed.listTool(_meta("Cordless drill", "18V, two batteries. Chuck is a bit worn."), 40e6, 3e6, 7);
        shed.listTool(_meta("Extension ladder", "6m aluminium. Heavy - bring a car."), 80e6, 5e6, 3);
        shed.listTool(_meta("Wheelbarrow", "Steel tray, tyre holds air fine."), 25e6, 2e6, 5);
        vm.stopBroadcast();

        // Ben lists two.
        vm.startBroadcast(PK_BEN);
        usdc.approve(address(shed), type(uint256).max);
        shed.listTool(_meta("Circular saw", "New blade fitted. Guard sticks occasionally."), 60e6, 4e6, 4);
        shed.listTool(_meta("Pressure washer", "1800W. Lance included, no patio brush."), 70e6, 5e6, 3);
        vm.stopBroadcast();

        vm.startBroadcast(PK_CYD);
        usdc.approve(address(shed), type(uint256).max);
        vm.stopBroadcast();

        // Ben takes Ana's drill for a week (he brings things back); Cyd takes the ladder for
        // two days (she will not).
        vm.broadcast(PK_BEN);
        uint64 benLoan = shed.requestLoan(1, 7);
        vm.broadcast(PK_CYD);
        uint64 cydLoan = shed.requestLoan(2, 2);

        vm.startBroadcast(PK_ANA);
        shed.approveRequest(benLoan);
        shed.approveRequest(cydLoan);
        vm.stopBroadcast();

        console.log("stage1 done: ben's loan", benLoan, "cyd's loan", cydLoan);
    }

    /// @dev After the clock jump: Ben returns on time-ish, Cyd is days late, and a fresh
    ///      request is left pending so the owner's queue has something in it.
    function stage2() external {
        _load();

        // Ben hands the drill back and Ana confirms.
        vm.broadcast(PK_BEN);
        shed.reportReturn(1);
        vm.broadcast(PK_ANA);
        shed.confirmReturn(1);

        // Cyd is late with the ladder: the fee comes out of her deposit.
        vm.broadcast(PK_ANA);
        shed.confirmReturn(2);

        // Ben borrows and returns the wheelbarrow cleanly, to give him a second good loan.
        vm.broadcast(PK_BEN);
        uint64 third = shed.requestLoan(3, 3);
        vm.startBroadcast(PK_ANA);
        shed.approveRequest(third);
        shed.confirmReturn(third);
        vm.stopBroadcast();

        // Two neighbours leave competing requests on Ben's saw, so the owner's queue actually
        // has something to sort: Cyd (one late return) and the steward (no history at all).
        vm.broadcast(PK_CYD);
        shed.requestLoan(4, 2);
        vm.startBroadcast(PK_STEWARD);
        usdc.approve(address(shed), type(uint256).max);
        shed.requestLoan(4, 3);
        vm.stopBroadcast();

        Toolshed.Member memory ben = shed.getMember(vm.addr(PK_BEN));
        Toolshed.Member memory cyd = shed.getMember(vm.addr(PK_CYD));
        console.log("ben: loans", ben.loansTaken, "late", ben.lateReturns);
        console.log("cyd: loans", cyd.loansTaken, "late", cyd.lateReturns);
    }

    /// @dev Metadata is normally pinned to IPFS by the app; inline data URIs keep local seeding
    ///      dependency-free and the frontend reads them the same way.
    function _meta(string memory name, string memory condition) private pure returns (string memory) {
        return
            string.concat(
                "data:application/json;utf8,", '{"name":"', name, '","condition":"', condition, '","image":""}'
            );
    }
}
