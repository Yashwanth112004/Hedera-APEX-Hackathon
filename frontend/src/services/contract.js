import { ethers } from "ethers"
import ABI from "../abi/RoleContract.json"

const CONTRACT_ADDRESS = "0x6Fb843e36869d3dc6Eb29b56b254E81dC8548970"

/* GET CONTRACT */

export async function getContract() {

  const provider = new ethers.BrowserProvider(window.ethereum)

  const signer = await provider.getSigner()

  const contract = new ethers.Contract(
    CONTRACT_ADDRESS,
    ABI,
    signer
  )

  return contract
}

/* GET ROLE */

export async function getRole(address) {

  const contract = await getContract()

  const role = await contract.getRole(address)

  return role
}

/* REQUEST ROLE */

export async function requestRole(role) {

  const contract = await getContract()

  const tx = await contract.requestRole(role)

  await tx.wait()

}

/* APPROVE ROLE */

export async function approveRole(wallet) {

  const contract = await getContract()

  const tx = await contract.approveRole(wallet)

  await tx.wait()

}

/* GET REQUESTS */

export async function getRequests() {

  const contract = await getContract()

  const requests = await contract.getRequests()

  return requests

}