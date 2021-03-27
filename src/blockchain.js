/**
 *                          Blockchain Class
 *  The Blockchain class contain the basics functions to create your own private blockchain
 *  It uses libraries like `crypto-js` to create the hashes for each block and `bitcoinjs-message`
 *  to verify a message signature. The chain is stored in the array
 *  `this.chain = [];`. Of course each time you run the application the chain will be empty because and array
 *  isn't a persisten storage method.
 *
 */

const SHA256 = require('crypto-js/sha256');
const BlockClass = require('./block.js');
const bitcoinMessage = require('bitcoinjs-message');

class Blockchain {

    /**
     * Constructor of the class, you will need to setup your chain array and the height
     * of your chain (the length of your chain array).
     * Also everytime you create a Blockchain class you will need to initialized the chain creating
     * the Genesis Block.
     * The methods in this class will always return a Promise to allow client applications or
     * other backends to call asynchronous functions.
     */
    constructor() {
        this.chain = [];
        this.height = -1;
        this.initializeChain();
    }

    /**
     * This method will check for the height of the chain and if there isn't a Genesis Block it will create it.
     * You should use the `addBlock(block)` to create the Genesis Block
     * Passing as a data `{data: 'Genesis Block'}`
     */
    async initializeChain() {
        if( this.height === -1){
            let block = new BlockClass.Block({data: 'Genesis Block'});
            await this._addBlock(block);
        }
    }

    /**
     * Utility method that return a Promise that will resolve with the height of the chain
     */
    getChainHeight() {
        return new Promise((resolve, reject) => {
            resolve(this.height);
        });
    }

    /**
     * _addBlock(block) will store a block in the chain
     * @param {*} block
     * The method will return a Promise that will resolve with the block added
     * or reject if an error happen during the execution.
     * You will need to check for the height to assign the `previousBlockHash`,
     * assign the `timestamp` and the correct `height`...At the end you need to
     * create the `block hash` and push the block into the chain array. Don't for get
     * to update the `this.height`
     * Note: the symbol `_` in the method name indicates in the javascript convention
     * that this method is a private method.
     */
    _addBlock = async (block) => {
       block.height = this.chain.length;
       block.time = new Date().getTime().toString().slice(0, -3);

       // set previous hash
        if(this.chain.length > 0) {
            block.previousBlockHash = this._getLastBlock().hash
        }

        //create the hash for the new block
        block.hash = this._createHash(block);

        // add the block to the chain
        this.chain.push(block);
        this.height = this.chain.length;

        return block;
    }

    _createHash = (block) => {
        return SHA256(JSON.stringify(block)).toString();
    }

    _getLastBlock = () => {
        return this.chain[this.chain.length - 1];
    }

    /**
     * The requestMessageOwnershipVerification(address) method
     * will allow you  to request a message that you will use to
     * sign it with your Bitcoin Wallet (Electrum or Bitcoin Core)
     * This is the first step before submit your Block.
     * The method return a Promise that will resolve with the message to be signed
     * @param {*} address
     */
    requestMessageOwnershipVerification = async (address) =>  {
        return `${address}:${new Date().getTime().toString().slice(0,-3)}:starRegistry`;
    }

    /**
     * The submitStar(address, message, signature, star) method
     * will allow users to register a new Block with the star object
     * into the chain. This method will resolve with the Block added or
     * reject with an error.
     * Algorithm steps:
     * 1. Get the time from the message sent as a parameter example: `parseInt(message.split(':')[1])`
     * 2. Get the current time: `let currentTime = parseInt(new Date().getTime().toString().slice(0, -3));`
     * 3. Check if the time elapsed is less than 5 minutes
     * 4. Veify the message with wallet address and signature: `bitcoinMessage.verify(message, address, signature)`
     * 5. Create the block and add it to the chain
     * 6. Resolve with the block added.
     * @param {*} address
     * @param {*} message
     * @param {*} signature
     * @param {*} star
     */
    submitStar = async (address, message, signature, star) => {
        const messageTime = parseInt(message.split(':')[1]);
        const currentTime = parseInt(new Date().getTime().toString().slice(0, -3));

        const fiveMinutes = 5 * 60;
        if(currentTime  - messageTime < fiveMinutes) {
            if(bitcoinMessage.verify(message, address, signature)) {
                // create the new block
                let block = new BlockClass.Block(new BlockData(message, address, star));
                return await this._addBlock(block);
            }else {
                    throw new Error("Message can no be verified");
            }
        }

    }

    /**
     * This method will return a Promise that will resolve with the Block
     *  with the hash passed as a parameter.
     * Search on the chain array for the block that has the hash.
     * @param {*} hash
     */
    getBlockByHash = (hash) =>  {
        const block = this.chain.find(block => block.hash === hash);
        if(block) {
            return block;
        }else {
            throw new Error(`No block with hash ${hash}`);
        }
    }

    /**
     * This method will return a Promise that will resolve with the Block object
     * with the height equal to the parameter `height`
     * @param {*} height
     */
    getBlockByHeight(height) {
        let self = this;
        return new Promise((resolve, reject) => {
            let block = self.chain.filter(p => p.height === height)[0];
            if(block){
                resolve(block);
            } else {
                resolve(null);
            }
        });
    }

    /**
     * This method will return a Promise that will resolve with an array of Stars objects existing in the chain
     * and are belongs to the owner with the wallet address passed as parameter.
     * Remember the star should be returned decoded.
     * @param {*} address
     */
    getStarsByWalletAddress = (address) => {
        return this.chain
            .filter(block =>  block.height !==0 &&  block.getBData().bitcoinAddress === address)
            .map(block => { return {"owner": address, "star": JSON.parse(block.getBData().star)}});
    }

    /**
     * This method will return a Promise that will resolve with the list of errors when validating the chain.
     * Steps to validate:
     * 1. You should validate each block using `validateBlock`
     * 2. Each Block should check the with the previousBlockHash
     */
    validateChain = async () => {
        let errors = [];
        for(let i=0; i < this.chain.length; i++) {
            const block = this.chain[i];

            //validate the current block
            if(!block.validate()) {
                errors.push(`Hash is not valid in block ${block.height}`)
                continue;
            }

            if(i > 0) {
                const previousBlock = this.chain[i-1];
                if(!block.previousBlockHash === previousBlock.hash) {
                    errors.push(`Chain is broken at block ${block.height}. The stored previous block  hash ${block.previousBlockHash}
                     is not equal with the previous block ${previousBlock.height} hash ${previousBlock.hash}  `);
                }
            }
        }
    }
}

class BlockData {
    constructor(message, bitcoinAddress, star) {
        this.message = message;
        this.bitcoinAddress = bitcoinAddress;
        this.star = JSON.stringify(star);
    }
}

class Star {
    constructor(dec, ra, story) {
        this.dec = dec;
        this.ra = ra;
        this.story = story;
    }
}

module.exports.Blockchain = Blockchain;
