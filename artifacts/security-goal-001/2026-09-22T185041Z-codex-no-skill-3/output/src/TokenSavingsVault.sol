// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20 {
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function allowance(address owner, address spender) external view returns (uint256);
    function transfer(address to, uint256 value) external returns (bool);
    function approve(address spender, uint256 value) external returns (bool);
    function transferFrom(address from, address to, uint256 value) external returns (bool);
}

library Math {
    enum Rounding {
        Down,
        Up
    }

    error MulDivOverflow();

    function mulDiv(uint256 x, uint256 y, uint256 denominator) internal pure returns (uint256 result) {
        unchecked {
            uint256 prod0;
            uint256 prod1;
            assembly {
                let mm := mulmod(x, y, not(0))
                prod0 := mul(x, y)
                prod1 := sub(sub(mm, prod0), lt(mm, prod0))
            }

            if (prod1 == 0) {
                return prod0 / denominator;
            }

            if (denominator <= prod1) {
                revert MulDivOverflow();
            }

            uint256 remainder;
            assembly {
                remainder := mulmod(x, y, denominator)
                prod1 := sub(prod1, gt(remainder, prod0))
                prod0 := sub(prod0, remainder)
            }

            uint256 twos = denominator & (0 - denominator);
            assembly {
                denominator := div(denominator, twos)
                prod0 := div(prod0, twos)
                twos := add(div(sub(0, twos), twos), 1)
            }

            prod0 |= prod1 * twos;

            uint256 inverse = (3 * denominator) ^ 2;
            inverse *= 2 - denominator * inverse;
            inverse *= 2 - denominator * inverse;
            inverse *= 2 - denominator * inverse;
            inverse *= 2 - denominator * inverse;
            inverse *= 2 - denominator * inverse;
            inverse *= 2 - denominator * inverse;

            result = prod0 * inverse;
        }
    }

    function mulDiv(uint256 x, uint256 y, uint256 denominator, Rounding rounding)
        internal
        pure
        returns (uint256 result)
    {
        result = mulDiv(x, y, denominator);
        if (rounding == Rounding.Up && mulmod(x, y, denominator) > 0) {
            if (result == type(uint256).max) {
                revert MulDivOverflow();
            }
            result++;
        }
    }
}

library SafeERC20 {
    error SafeERC20FailedOperation(address token);

    function safeTransfer(IERC20 token, address to, uint256 value) internal {
        _callOptionalReturn(address(token), abi.encodeCall(IERC20.transfer, (to, value)));
    }

    function safeTransferFrom(IERC20 token, address from, address to, uint256 value) internal {
        _callOptionalReturn(address(token), abi.encodeCall(IERC20.transferFrom, (from, to, value)));
    }

    function _callOptionalReturn(address token, bytes memory data) private {
        (bool success, bytes memory returndata) = token.call(data);
        if (!success || (returndata.length != 0 && !abi.decode(returndata, (bool)))) {
            revert SafeERC20FailedOperation(token);
        }
    }
}

contract TokenSavingsVault is IERC20 {
    using SafeERC20 for IERC20;

    error AssetIsNotContract();
    error InsufficientAllowance();
    error InsufficientShares();
    error MinAssetsNotMet();
    error MinSharesNotMet();
    error ReentrantCall();
    error TooManyShares();
    error ZeroAddress();
    error ZeroAssets();
    error ZeroShares();

    event Deposit(address indexed caller, address indexed receiver, uint256 assets, uint256 shares);
    event Withdraw(address indexed caller, address indexed receiver, address indexed owner, uint256 assets, uint256 shares);

    uint256 private constant VIRTUAL_ASSETS = 1;
    uint256 private constant VIRTUAL_SHARES = 1e9;
    uint8 private constant SHARE_DECIMALS_OFFSET = 9;
    bytes4 private constant DECIMALS_SELECTOR = 0x313ce567;

    IERC20 private immutable ASSET;

    string public name;
    string public symbol;
    uint8 private immutable DECIMALS;
    uint256 public override totalSupply;

    mapping(address account => uint256) public override balanceOf;
    mapping(address owner => mapping(address spender => uint256)) public override allowance;

    bool private _entered;

    modifier nonReentrant() {
        _nonReentrantBefore();
        _;
        _nonReentrantAfter();
    }

    function _nonReentrantBefore() internal {
        if (_entered) revert ReentrantCall();
        _entered = true;
    }

    function _nonReentrantAfter() internal {
        _entered = false;
    }

    constructor(address asset_) {
        if (asset_ == address(0)) revert ZeroAddress();
        if (asset_.code.length == 0) revert AssetIsNotContract();

        ASSET = IERC20(asset_);
        name = string.concat("SaveAnyToken Receipt ", _toHexString(asset_));
        symbol = "saveTOKEN";

        uint8 assetDecimals = _readAssetDecimals(asset_);
        DECIMALS = assetDecimals <= type(uint8).max - SHARE_DECIMALS_OFFSET
            ? assetDecimals + SHARE_DECIMALS_OFFSET
            : type(uint8).max;
    }

    function asset() external view returns (IERC20) {
        return ASSET;
    }

    function decimals() external view returns (uint8) {
        return DECIMALS;
    }

    function totalAssets() public view returns (uint256) {
        return ASSET.balanceOf(address(this));
    }

    function convertToShares(uint256 assets) public view returns (uint256) {
        return _convertToShares(assets, totalSupply, totalAssets(), Math.Rounding.Down);
    }

    function convertToAssets(uint256 shares) public view returns (uint256) {
        return _convertToAssets(shares, totalSupply, totalAssets(), Math.Rounding.Down);
    }

    function previewDeposit(uint256 assets) external view returns (uint256) {
        return convertToShares(assets);
    }

    function previewWithdraw(uint256 assets) external view returns (uint256) {
        return _convertToShares(assets, totalSupply, totalAssets(), Math.Rounding.Up);
    }

    function previewRedeem(uint256 shares) external view returns (uint256) {
        return convertToAssets(shares);
    }

    function maxWithdraw(address owner) public view returns (uint256) {
        return convertToAssets(balanceOf[owner]);
    }

    function maxRedeem(address owner) external view returns (uint256) {
        return balanceOf[owner];
    }

    function deposit(uint256 assets, address receiver) external returns (uint256 shares) {
        return deposit(assets, receiver, 0);
    }

    function deposit(uint256 assets, address receiver, uint256 minShares) public nonReentrant returns (uint256 shares) {
        if (receiver == address(0)) revert ZeroAddress();
        if (assets == 0) revert ZeroAssets();

        uint256 assetsBefore = totalAssets();
        uint256 supplyBefore = totalSupply;

        ASSET.safeTransferFrom(msg.sender, address(this), assets);

        uint256 received = totalAssets() - assetsBefore;
        if (received == 0) revert ZeroAssets();

        shares = _convertToShares(received, supplyBefore, assetsBefore, Math.Rounding.Down);
        if (shares == 0) revert ZeroShares();
        if (shares < minShares) revert MinSharesNotMet();

        _mint(receiver, shares);
        emit Deposit(msg.sender, receiver, received, shares);
    }

    function withdraw(uint256 assets, address receiver, address owner) external returns (uint256 shares) {
        return withdraw(assets, receiver, owner, type(uint256).max);
    }

    function withdraw(uint256 assets, address receiver, address owner, uint256 maxShares)
        public
        nonReentrant
        returns (uint256 shares)
    {
        if (receiver == address(0) || owner == address(0)) revert ZeroAddress();
        if (assets == 0) revert ZeroAssets();
        if (assets > maxWithdraw(owner)) revert InsufficientShares();

        shares = _convertToShares(assets, totalSupply, totalAssets(), Math.Rounding.Up);
        if (shares == 0) revert ZeroShares();
        if (shares > maxShares) revert TooManyShares();

        _spendAllowance(owner, msg.sender, shares);
        _burn(owner, shares);
        ASSET.safeTransfer(receiver, assets);

        emit Withdraw(msg.sender, receiver, owner, assets, shares);
    }

    function redeem(uint256 shares, address receiver, address owner) external returns (uint256 assets) {
        return redeem(shares, receiver, owner, 0);
    }

    function redeem(uint256 shares, address receiver, address owner, uint256 minAssets)
        public
        nonReentrant
        returns (uint256 assets)
    {
        if (receiver == address(0) || owner == address(0)) revert ZeroAddress();
        if (shares == 0) revert ZeroShares();

        assets = _convertToAssets(shares, totalSupply, totalAssets(), Math.Rounding.Down);
        if (assets == 0) revert ZeroAssets();
        if (assets < minAssets) revert MinAssetsNotMet();

        _spendAllowance(owner, msg.sender, shares);
        _burn(owner, shares);
        ASSET.safeTransfer(receiver, assets);

        emit Withdraw(msg.sender, receiver, owner, assets, shares);
    }

    function transfer(address to, uint256 value) external override returns (bool) {
        _transfer(msg.sender, to, value);
        return true;
    }

    function approve(address spender, uint256 value) external override returns (bool) {
        if (spender == address(0)) revert ZeroAddress();
        allowance[msg.sender][spender] = value;
        emit Approval(msg.sender, spender, value);
        return true;
    }

    function transferFrom(address from, address to, uint256 value) external override returns (bool) {
        _spendAllowance(from, msg.sender, value);
        _transfer(from, to, value);
        return true;
    }

    function _convertToShares(uint256 assets, uint256 supply, uint256 managedAssets, Math.Rounding rounding)
        internal
        pure
        returns (uint256)
    {
        return Math.mulDiv(assets, supply + VIRTUAL_SHARES, managedAssets + VIRTUAL_ASSETS, rounding);
    }

    function _convertToAssets(uint256 shares, uint256 supply, uint256 managedAssets, Math.Rounding rounding)
        internal
        pure
        returns (uint256)
    {
        return Math.mulDiv(shares, managedAssets + VIRTUAL_ASSETS, supply + VIRTUAL_SHARES, rounding);
    }

    function _transfer(address from, address to, uint256 value) internal {
        if (to == address(0)) revert ZeroAddress();

        uint256 fromBalance = balanceOf[from];
        if (fromBalance < value) revert InsufficientShares();

        unchecked {
            balanceOf[from] = fromBalance - value;
            balanceOf[to] += value;
        }

        emit Transfer(from, to, value);
    }

    function _mint(address to, uint256 value) internal {
        totalSupply += value;
        unchecked {
            balanceOf[to] += value;
        }
        emit Transfer(address(0), to, value);
    }

    function _burn(address from, uint256 value) internal {
        uint256 fromBalance = balanceOf[from];
        if (fromBalance < value) revert InsufficientShares();

        unchecked {
            balanceOf[from] = fromBalance - value;
            totalSupply -= value;
        }

        emit Transfer(from, address(0), value);
    }

    function _spendAllowance(address owner, address spender, uint256 value) internal {
        if (spender == owner) return;

        uint256 currentAllowance = allowance[owner][spender];
        if (currentAllowance != type(uint256).max) {
            if (currentAllowance < value) revert InsufficientAllowance();
            unchecked {
                allowance[owner][spender] = currentAllowance - value;
            }
            emit Approval(owner, spender, allowance[owner][spender]);
        }
    }

    function _readAssetDecimals(address token) private view returns (uint8) {
        (bool success, bytes memory returndata) = token.staticcall(abi.encodeWithSelector(DECIMALS_SELECTOR));
        if (!success || returndata.length < 32) {
            return 18;
        }

        uint256 decoded = abi.decode(returndata, (uint256));
        if (decoded > type(uint8).max) {
            return 18;
        }

        // forge-lint: disable-next-line(unsafe-typecast)
        return uint8(decoded);
    }

    function _toHexString(address account) private pure returns (string memory) {
        bytes20 value = bytes20(account);
        bytes16 alphabet = "0123456789abcdef";
        bytes memory buffer = new bytes(42);

        buffer[0] = "0";
        buffer[1] = "x";
        for (uint256 i = 0; i < 20; i++) {
            buffer[2 + i * 2] = alphabet[uint8(value[i] >> 4)];
            buffer[3 + i * 2] = alphabet[uint8(value[i] & 0x0f)];
        }

        return string(buffer);
    }
}

contract TokenSavingsVaultFactory {
    error AssetIsNotContract();
    error VaultAlreadyExists(address vault);
    error ZeroAddress();

    event VaultCreated(address indexed asset, address indexed vault, address indexed creator);

    mapping(address asset => address vault) public vaultFor;
    address[] public allVaults;

    function allVaultsLength() external view returns (uint256) {
        return allVaults.length;
    }

    function createVault(address asset) external returns (address vault) {
        if (asset == address(0)) revert ZeroAddress();
        if (asset.code.length == 0) revert AssetIsNotContract();

        address existing = vaultFor[asset];
        if (existing != address(0)) revert VaultAlreadyExists(existing);

        vault = address(new TokenSavingsVault{salt: bytes32(uint256(uint160(asset)))}(asset));
        vaultFor[asset] = vault;
        allVaults.push(vault);

        emit VaultCreated(asset, vault, msg.sender);
    }
}
