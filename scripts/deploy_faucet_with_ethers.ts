// Deploy Faucet contract with ethers.js in Remix
// Compile "./contracts/4_Faucet.sol" before running this script.

import { deploy } from './ethers-lib'

(async () => {
  try {
    const result = await deploy('Faucet', [])
    console.log(`Faucet deployed at: ${result.address}`)
  } catch (e) {
    console.log(e.message)
  }
})()