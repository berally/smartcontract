export type Config = {
    brlyAddress: string
    rewardsAddress: string
    withdrawLockingTime: number
}

export const getConfig = (networkName: string): Config => {
    switch (networkName) {
        case "berachainTestnet":
            return {
                brlyAddress: "0xc32Ee7b923D65f57E22Ba982D2c4e4c51FB9B0Df",
                rewardsAddress: "0x0E4aaF1351de4c0264C5c7056Ef3777b41BD8e03",
                withdrawLockingTime: 60 * 60 * 24 * 7, // 7 days
            };
        default:
            throw new Error
    }
}