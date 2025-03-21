export type Config = {
    rewardAddress: string
}

export const getConfig = (networkName: string): Config => {
    switch (networkName) {
        case "berachainTestnet":
            return {
                rewardAddress: "",
            };
        case "berachainMainnet":
            return {
                rewardAddress: "0x5C43a5fEf2b056934478373A53d1cb08030fd382",
            };
        default:
            throw new Error
    }
}