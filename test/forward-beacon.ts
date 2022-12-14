import { expect } from "chai";
import { artifacts, ethers, upgrades } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { getBeaconProxyFactory } from "@openzeppelin/hardhat-upgrades/dist/utils";

describe("Forward Beacon", function () {
  async function deployPriceFeed() {
    const PriceFeed = await ethers.getContractFactory("PriceFeed");
    const priceFeed = await PriceFeed.deploy(120000);
    await priceFeed.deployed();
    return {
      priceFeed,
    };
  }
  async function deployForwardBeacon() {
    const ForwardBase = await ethers.getContractFactory("ForwardBase");
    const forwardBeacon = await upgrades.deployBeacon(ForwardBase);
    await forwardBeacon.deployed();
    return {
      forwardBeacon,
      ForwardBase,
    };
  }
  async function deployBeaconProxyContract() {
    const { priceFeed } = await deployPriceFeed();
    const { forwardBeacon, ForwardBase } = await deployForwardBeacon();
    const BeaconProxy = await artifacts.readArtifact("BeaconProxy");

    console.log(BeaconProxy);
  }
  async function deployAndUpdateBeaconProxies() {
    const { priceFeed } = await deployPriceFeed();
    const { forwardBeacon, ForwardBase } = await deployForwardBeacon();

    const [a1, a2, b1, b2, c1, c2] = await ethers.getSigners();
    const deployAndStartProxy = async (user1: any, user2: any) => {
      const contract = await upgrades.deployBeaconProxy(
        forwardBeacon,
        ForwardBase,
        [priceFeed.address],
        {
          initializer: "initialize",
        }
      );
      await contract.deployed();
      await contract.propose((await time.latest()) + 60 * 60 * 5, {
        value: ethers.utils.parseEther("0.1"),
      });
      await contract
        .connect(user2)
        .agree({ value: ethers.utils.parseEther("0.1") });

      return contract;
    };

    const proxy1 = await deployAndStartProxy(a1, a2);
    const proxy2 = await deployAndStartProxy(b1, b2);
    const proxy3 = await deployAndStartProxy(c1, c2);

    const ForwardBaseUpdateTest = await ethers.getContractFactory(
      "ForwardBaseUpdateTest"
    );

    await upgrades.upgradeBeacon(forwardBeacon.address, ForwardBaseUpdateTest);

    return {
      proxy1: await ForwardBaseUpdateTest.attach(proxy1.address),
      proxy2: await ForwardBaseUpdateTest.attach(proxy2.address),
      proxy3: await ForwardBaseUpdateTest.attach(proxy3.address),
    };
  }
  it("deploys and updates three beacon proxies with hardhat library functions", async function () {
    const { proxy1, proxy2, proxy3 } = await loadFixture(
      deployAndUpdateBeaconProxies
    );
    const sameUpdateResult = [
      await proxy1.updated(),
      await proxy2.updated(),
      await proxy3.updated(),
    ]
      .map((item) => item.toString())
      .every((item) => item === "200");
    expect(sameUpdateResult).to.equal(true);
  });
});
