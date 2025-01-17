export type Config = {
    rewardAddress: string
}

export const getConfig = (networkName: string): Config => {
    switch (networkName) {
        case "berachainTestnet":
            return {
                rewardAddress: "",
            };
        default:
            throw new Error
    }
}