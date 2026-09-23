// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test, console2} from "forge-std/Test.sol";
import {BatchSender} from "../src/BatchSender.sol";

interface IERC20 {
    function transfer(address, uint256) external returns (bool);
    function approve(address, uint256) external returns (bool);
}

interface IGasPriceOracle {
    function getL1Fee(bytes memory data) external view returns (uint256);
}

contract BaseForkMeasure is Test {
    address constant USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
    address constant WHALE = 0x498581fF718922c3f8e6A244956aF099B2652b2b;
    address constant ORACLE = 0x420000000000000000000000000000000000000F;
    uint256 constant AMOUNT = 1e6;
    uint256 constant N = 100;
    uint160 constant FRESH_BASE = 462428252436731001462884654101636424188009906176;

    address[100] holders;

    function setUp() public {
        if (block.chainid != 8453) vm.skip(true);
        holders[0] = 0x000000000001CdB57E58Fa75Fe420a0f4D6640D5;
        holders[1] = 0x000000000004598D17aaD017bF0734a364c5588b;
        holders[2] = 0x00000000009726632680FB29d3F7A9734E3010E2;
        holders[3] = 0x0000000000bbF5c5Fd284e657F01Bd000933C96D;
        holders[4] = 0x0000000071647c6C1AE028daf9f80c000bEac2cC;
        holders[5] = 0x00000000e91fc5BAd977C0cc4Ad60557c06886a2;
        holders[6] = 0x0000000f2eB9f69274678c76222B35eEc7588a65;
        holders[7] = 0x000000dDD3b5F19E67806c13F4194989Bd02916a;
        holders[8] = 0x0000eFC4ec03a7c47D3a38A9Be7Ff1d52dD01b99;
        holders[9] = 0x00012c436240Fa0b7286AA85CA098C9fd8cc2000;
        holders[10] = 0x0005Ea38EB0a69D1253508EBDBdB9eA8Cb26B5Ef;
        holders[11] = 0x000dAD45Ba054d6Ad1264c810b7Ea55fC32A3B28;
        holders[12] = 0x0014c27400B7029BCDE1E41f8fbd38dFa9c28d45;
        holders[13] = 0x00195AD9Bf280Ec242a7Bb28F1C33d91BEfAB505;
        holders[14] = 0x001b883eB2aBfA28baD2484cCC59db7E431A6884;
        holders[15] = 0x0069A5b0B1e3d5C56Fe607F2173cB10265AFd1c4;
        holders[16] = 0x006a1A936957b5286a92a4E1886e01C1985611bc;
        holders[17] = 0x006D0E0D006109F0020F3050000A713780B7B000;
        holders[18] = 0x00700052c0608F670705380a4900e0a8080010CC;
        holders[19] = 0x00747C73cC9c82A633cEB29a1665A370C55237fA;
        holders[20] = 0x0076c81fe5F80045eEF7fB011E066bCd8Fd37Baa;
        holders[21] = 0x00832cb27A4Df7F715223583Be38127f8ED0aB1c;
        holders[22] = 0x0083a41EDCc59BE17532b979c36a48a89dD16766;
        holders[23] = 0x00A20887Da1570138559a24C6E97Ccd8A77d1D5B;
        holders[24] = 0x00aC0b133213b21A6297cA21db03E06bfFD41402;
        holders[25] = 0x00B6704B6f1341d9b74d1481cEeDdc7a45B2F999;
        holders[26] = 0x00b7aF089770a1ED44648213Cd56d6E4d80411f5;
        holders[27] = 0x00c01f413B53C9c8a48Dd5e92c3714B29bdA4CDA;
        holders[28] = 0x00CD66EE7539919EB557065BA1D7E8303372a376;
        holders[29] = 0x00E427a0a2A842F8a13f61Aa2213BF4ae38153D0;
        holders[30] = 0x00EdAcbD486463FCE35d6bB7265a124b91eF7357;
        holders[31] = 0x00efeEce75Fb837d1980d87bB9F8076a0E81F0a2;
        holders[32] = 0x00f3F29B8A1240EC73Aab22e1d2433ebf6a0B7a2;
        holders[33] = 0x00fB80C560338a0cF07c6Efe04D7039cE41Bb738;
        holders[34] = 0x00fC00edbe7C003b006f870068c548940000223e;
        holders[35] = 0x00Ffd95D55AeFAf7a1ba594AfB233d048593089A;
        holders[36] = 0x0101D317b738390cCc34686A3593a2C1740e098e;
        holders[37] = 0x0106cc76326D3f66825387b4076D106e23CDaEf2;
        holders[38] = 0x010e28EC389FCC6bF39b846b2Bc400D08340387f;
        holders[39] = 0x01164483704ce26f1EC3F54651C33d5D634211D1;
        holders[40] = 0x012204066A5103B69D9De0F783286cA670D8a1d5;
        holders[41] = 0x012364859a225Ce3f7D99B15b0a9Dc644976ffb6;
        holders[42] = 0x0124859dDdFdeBD7491312af8Ae0b870d0a4f5Fd;
        holders[43] = 0x01248FEdc52A06b92F0F1a61886e1275317a15Fb;
        holders[44] = 0x012a81F1827f2dC2B6DBe90Ae27BEf54013dF778;
        holders[45] = 0x0133eef4D6237a682b5f572297F6eE496A26ea7F;
        holders[46] = 0x013a2A132EF92f391AC21375DfE3E705c90806Af;
        holders[47] = 0x013aCD520D6ae7c96Cb4EBA856a6252826b206Af;
        holders[48] = 0x013cbFA9E9Be8f76bb1e7e46034FA5732980684B;
        holders[49] = 0x013d5349eAe975BDd54fe5F70627Df3e5F0Cd423;
        holders[50] = 0x014025fDE093f8701d86e9f38e2C3a9b779cb5c7;
        holders[51] = 0x01403381Ef154391730ddC4278F481a7117A7b66;
        holders[52] = 0x014056D2F6d159367466E15EE25E1Edc2345a9b8;
        holders[53] = 0x014d24F36F440a7d7a0Ef04eC2361A52302414d1;
        holders[54] = 0x0150e3d89E161518C044ad191c4bdf6b40Df6E83;
        holders[55] = 0x0151b900b8C27b02cBe4E85F325Db56e81bA86E0;
        holders[56] = 0x01574A2cF34043900D9aA41E39c4BD2C895CEC5C;
        holders[57] = 0x0164f882BE2649e2C179Ad3457Ca0a6c6ea4DFb3;
        holders[58] = 0x017dce16a5c6ad86CE177383AD722Ee1E83E35e6;
        holders[59] = 0x017Fd707ab39ecF955ffA0c489dF6A937bB6BD9b;
        holders[60] = 0x01821D4a3496dea5d9870886aE15F221322615f6;
        holders[61] = 0x018a4B009AE6FcA579a75D4daB3e1354EB1625Ae;
        holders[62] = 0x018e907e5f313cf436FD43885f56aC32B76b0F7B;
        holders[63] = 0x01989C93890AeD05a63d179b03424997075B6acF;
        holders[64] = 0x01997c54742B3d8F107C4e53Fef07113Ab043Ec6;
        holders[65] = 0x019b6e076848510fEA83453568bfE9375B0C3a43;
        holders[66] = 0x019f6a0D5F56711c05678cd9Ab23fb1Ec94AEE31;
        holders[67] = 0x01A34a3a5F45F3E3dCbF9F002E4886fDBd587E61;
        holders[68] = 0x01A36dDB2bD150898b891372480b95c362D17E61;
        holders[69] = 0x01aa9280D548d26b3b7cE4Af8dA5E1775e7f3FC0;
        holders[70] = 0x01adC19d5C6fdC17f79608426B7D885425E3B25E;
        holders[71] = 0x01BfD8ECe1309A11adAD54f62c644173a7039dA0;
        holders[72] = 0x01CC657440CF0B424f3C356D65AB93b7ED8E9f1c;
        holders[73] = 0x01D8266C7410A22be1580035e4BE18e28D3C5232;
        holders[74] = 0x01DACDa61985876109d00E9d4E9eAC598A318b70;
        holders[75] = 0x01DbFA8E206e1f849F4af3C77359e31CF9ace3c6;
        holders[76] = 0x01DC942C8c6955C050B8065c151c04a34bafdf4d;
        holders[77] = 0x01F142F983100B7E2D1ED7876133FBae6CD7B5a4;
        holders[78] = 0x01F5D2f2D24B78a8b15c1F4fb0A2D5E49906d17B;
        holders[79] = 0x020352f59CC09FB0C7B489f11F7510a417598124;
        holders[80] = 0x020852F9b42588C9792587A9E42fc2f9B6270f02;
        holders[81] = 0x020EC1Ee328EC898e9BF8b1193B34CBC55EdFE87;
        holders[82] = 0x02107bAb40bBA06AE979A15f67B5AD3853c5E116;
        holders[83] = 0x021e6c249e67fdE364948543eAAbB2Bb5007d99E;
        holders[84] = 0x02210CF173bbce41c6f4cBa5179FB26226099790;
        holders[85] = 0x023b3AC4f09d8C1B8C8405d83e02ecfFe79610E6;
        holders[86] = 0x02440be7438291915d5742B6C8C0d2E7999d7d88;
        holders[87] = 0x0263fCf6e33d1769d0E791ac1f00C55988aC9C4d;
        holders[88] = 0x026a47116Fa31EB630f4A98a8EEae31c11C7eF94;
        holders[89] = 0x0273C0aFe1ef00ed3895313FEE1c0b52D56285Cb;
        holders[90] = 0x02808A7CA324e5F51331081B763EDBB0d6bdcCeA;
        holders[91] = 0x0294148751D4d0A7e8B9868787874ddfd0e10930;
        holders[92] = 0x029D6dAba72019F73B85bAD6e64C25A2d85C54A2;
        holders[93] = 0x02a78632215262A94ce8651846e7D22ADc98Ce3C;
        holders[94] = 0x02B29606D5F7C69E84943F01d249C7f222A13D33;
        holders[95] = 0x02B6B7AB1eDE16F48C57893d2FdF6251C2CB3821;
        holders[96] = 0x02c9C3cF017c5515fD3B7d7C2c5316D08de787B9;
        holders[97] = 0x02dd4285AD38eA93d021CA854016A839b0B2a6Ca;
        holders[98] = 0x02eB5CE715121899C4d592A26bAC6720B5EE162d;
        holders[99] = 0x030630d9381145729d4abcdF3522Eb2F4445e5eC;
    }

    function _fresh(uint160 i) internal pure returns (address) {
        return address(FRESH_BASE + i);
    }

    function _batch(uint160 first, uint256 count) internal view returns (BatchSender.Payment[] memory p) {
        p = new BatchSender.Payment[](count);
        for (uint256 i; i < count; ++i) {
            p[i] = BatchSender.Payment(USDC, address(uint160(first + i)), AMOUNT);
        }
    }

    function _holderBatch(uint256 first, uint256 count) internal view returns (BatchSender.Payment[] memory p) {
        p = new BatchSender.Payment[](count);
        for (uint256 i; i < count; ++i) {
            p[i] = BatchSender.Payment(USDC, holders[first + i], AMOUNT);
        }
    }

    function test_measure_individual() public {
        vm.startPrank(WHALE);
        uint256 g0 = gasleft();
        IERC20(USDC).transfer(_fresh(1), AMOUNT);
        console2.log("individual, fresh recipient (exec only):", g0 - gasleft());

        IERC20(USDC).transfer(_fresh(2), AMOUNT);
        uint256 g1 = gasleft();
        IERC20(USDC).transfer(_fresh(2), AMOUNT);
        console2.log("individual, warm recipient (exec only):", g1 - gasleft());

        uint256 g2 = gasleft();
        IERC20(USDC).transfer(holders[0], AMOUNT);
        console2.log("individual, cold holder w/ balance (exec only):", g2 - gasleft());
        vm.stopPrank();
    }

    function test_measure_batch_fresh() public {
        BatchSender b = new BatchSender(WHALE);
        vm.startPrank(WHALE);
        IERC20(USDC).approve(address(b), type(uint256).max);
        uint256 g1 = gasleft();
        b.send(_batch(1000, 1));
        uint256 used1 = g1 - gasleft();
        uint256 gN = gasleft();
        b.send(_batch(2000, N));
        uint256 usedN = gN - gasleft();
        console2.log("batch(1) fresh, total exec:", used1);
        console2.log("batch(N) fresh, total exec:", usedN);
        console2.log("batch marginal per transfer, fresh recipient:", (usedN - used1) / (N - 1));
        vm.stopPrank();
    }

    function test_measure_batch_cold_holder() public {
        BatchSender b = new BatchSender(WHALE);
        vm.startPrank(WHALE);
        IERC20(USDC).approve(address(b), type(uint256).max);
        uint256 g1 = gasleft();
        b.send(_holderBatch(0, 1));
        uint256 used1 = g1 - gasleft();
        uint256 gN = gasleft();
        b.send(_holderBatch(1, N - 1));
        uint256 usedN = gN - gasleft();
        console2.log("batch(1) cold holder, total exec:", used1);
        console2.log("batch(N-1) cold holders, total exec:", usedN);
        console2.log("batch marginal per transfer, cold holder w/ balance:", (usedN - used1) / (N - 2));
        vm.stopPrank();
    }

    function test_measure_batch_warm() public {
        BatchSender b = new BatchSender(WHALE);
        vm.startPrank(WHALE);
        IERC20(USDC).approve(address(b), type(uint256).max);
        b.send(_batch(3000, N));
        uint256 g1 = gasleft();
        b.send(_batch(3000, 1));
        uint256 used1 = g1 - gasleft();
        uint256 gN = gasleft();
        b.send(_batch(3000, N));
        uint256 usedN = gN - gasleft();
        console2.log("batch(1) warm, total exec:", used1);
        console2.log("batch(N) warm, total exec:", usedN);
        console2.log("batch marginal per transfer, warm recipient:", (usedN - used1) / (N - 1));
        vm.stopPrank();
    }

    function test_measure_l1_fees() public view {
        uint256 individual = IGasPriceOracle(ORACLE).getL1Fee(
            abi.encodePacked(bytes4(0xa9059cbb), abi.encode(_fresh(1), AMOUNT))
        );
        console2.log("L1 fee, individual transfer calldata (wei):", individual);

        BatchSender.Payment[] memory p = new BatchSender.Payment[](N);
        for (uint256 i; i < N; ++i) {
            p[i] = BatchSender.Payment(USDC, _fresh(uint160(4000 + i)), AMOUNT);
        }
        uint256 batch = IGasPriceOracle(ORACLE).getL1Fee(abi.encodeCall(BatchSender.send, (p)));
        console2.log("L1 fee, batch(100) calldata (wei):", batch);
        console2.log("L1 fee per transfer in batch(100) (wei):", batch / N);
    }
}
