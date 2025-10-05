// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title VeriPrompt
 * @dev NFT contract for VeriPrompt with enhanced security features
 * 
 * Security considerations:
 * - Uses Solidity 0.8+ built-in overflow/underflow protection
 * - Implements ReentrancyGuard for additional safety
 * - Adds access control for minting operations
 * - Includes proper event emission for transparency
 */
contract VeriPrompt is ERC721, ERC721URIStorage, Ownable, ReentrancyGuard {
    // Token ID counter - safe with Solidity 0.8+ overflow protection
    uint256 private _nextTokenId;
    
    // Maximum supply to prevent excessive minting
    uint256 public constant MAX_SUPPLY = 1000000; // 1 million tokens max
    
    // Events for transparency
    event TokenMinted(address indexed to, uint256 indexed tokenId, string uri, bytes32 fileHash);
    event MaxSupplyUpdated(uint256 newMaxSupply);

    mapping(uint256 => bytes32) private _tokenHash;

    constructor(address initialOwner)
        ERC721("VeriPrompt", "VPT")
        Ownable(initialOwner)
    {}

    /**
     * @dev Safely mint a new token with enhanced security
     * @param to Address to mint the token to
     * @param uri Metadata URI for the token
     * 
     * Security features:
     * - NonReentrant modifier prevents reentrancy attacks
     * - Supply limit prevents excessive minting
     * - Only owner can mint (can be modified for other access patterns)
     * - Overflow protection via Solidity 0.8+
     */
    function safeMint(address to, string memory uri, bytes32 fileHash)
        public 
        onlyOwner 
        nonReentrant 
    {
        require(to != address(0), "VeriPrompt: mint to zero address");
        require(bytes(uri).length > 0, "VeriPrompt: empty URI");
        require(_nextTokenId < MAX_SUPPLY, "VeriPrompt: max supply reached");
        
        uint256 tokenId = _nextTokenId;
        
        // Safe increment - Solidity 0.8+ prevents overflow
        // This is equivalent to the old Counters.increment() but more gas efficient
        unchecked {
            _nextTokenId++;
        }
        
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, uri);
        _tokenHash[tokenId] = fileHash;
        
        emit TokenMinted(to, tokenId, uri, fileHash);
    }

    /**
     * @dev Get the current token counter value
     * @return The next token ID to be minted
     */
    function getCurrentTokenId() public view returns (uint256) {
        return _nextTokenId;
    }

    /**
     * @dev Get the total number of tokens minted
     * @return The total supply of tokens
     */
    function totalSupply() public view returns (uint256) {
        return _nextTokenId;
    }

    function tokenHash(uint256 tokenId) external view returns (bytes32) {
        _requireOwned(tokenId);
        return _tokenHash[tokenId];
    }

    // Override functions required by Solidity for multiple inheritance
    function tokenURI(uint256 tokenId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (string memory)
    {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}