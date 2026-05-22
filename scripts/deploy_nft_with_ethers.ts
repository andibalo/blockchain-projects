// Deploy SimpleNFT contract with ethers.js in Remix
// Compile "./contracts/5_SimpleNFT.sol" before running this script.

import { deploy } from './ethers-lib'

(async () => {
  try {
    const result = await deploy('SimpleNFT', [])
    console.log(`SimpleNFT deployed at: ${result.address}`)
  } catch (e) {
    console.log(e.message)
  }
})()