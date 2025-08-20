import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title BasketToken with enhanced security
 * @dev ERC20 token representing shares in a basket with transfer hooks
 */
contract BasketToken is ERC20, Ownable {
    address public immutable controller;
    bool public transfersEnabled;
    
    mapping(address => bool) public blacklisted;
    mapping(address => uint256) public lastTransferTime;
    
    uint256 public constant TRANSFER_COOLDOWN = 1 minutes;

    event TransfersEnabled();
    event TransfersDisabled();
    event AddressBlacklisted(address indexed account);
    event AddressUnblacklisted(address indexed account);

    modifier onlyController() {
        require(msg.sender == controller, "Only controller");
        _;
    }

    modifier transferAllowed(address from, address to) {
        require(transfersEnabled, "Transfers disabled");
        require(!blacklisted[from] && !blacklisted[to], "Address blacklisted");
        require(
            block.timestamp >= lastTransferTime[from] + TRANSFER_COOLDOWN,
            "Transfer cooldown active"
        );
        _;
    }

    constructor(
        string memory name,
        string memory symbol,
        address _controller
    ) ERC20(name, symbol) {
        controller = _controller;
        transfersEnabled = true;
        _transferOwnership(_controller);
    }

    function mint(address to, uint256 amount) external onlyController {
        _mint(to, amount);
    }

    function burn(address from, uint256 amount) external onlyController {
        _burn(from, amount);
    }

    function transfer(address to, uint256 amount) 
        public 
        override 
        transferAllowed(msg.sender, to) 
        returns (bool) 
    {
        lastTransferTime[msg.sender] = block.timestamp;
        
        // Call back to controller for fee accounting
        _beforeTokenTransfer(msg.sender, to, amount);
        
        return super.transfer(to, amount);
    }

    function transferFrom(address from, address to, uint256 amount) 
        public 
        override 
        transferAllowed(from, to) 
        returns (bool) 
    {
        lastTransferTime[from] = block.timestamp;
        
        // Call back to controller for fee accounting
        _beforeTokenTransfer(from, to, amount);
        
        return super.transferFrom(from, to, amount);
    }

    function _beforeTokenTransfer(address from, address to, uint256 amount) internal override {
        if (from != address(0) && to != address(0)) {
            // Notify controller about transfer for fee accounting
            IBasketController(controller).onTokenTransfer(from, to, amount);
        }
        super._beforeTokenTransfer(from, to, amount);
    }

    function enableTransfers() external onlyOwner {
        transfersEnabled = true;
        emit TransfersEnabled();
    }

    function disableTransfers() external onlyOwner {
        transfersEnabled = false;
        emit TransfersDisabled();
    }

    function blacklistAddress(address account) external onlyOwner {
        blacklisted[account] = true;
        emit AddressBlacklisted(account);
    }

    function unblacklistAddress(address account) external onlyOwner {
        blacklisted[account] = false;
        emit AddressUnblacklisted(account);
    }
}
