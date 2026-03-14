async function main(){

  const Volunteer = await ethers.getContractFactory("VolunteerRegistry");

  const contract = await Volunteer.deploy();

  await contract.waitForDeployment();

  const address = await contract.getAddress();

  console.log("VolunteerRegistry deployed to:",address);

}

main().catch((error)=>{
  console.error(error);
  process.exitCode = 1;
});