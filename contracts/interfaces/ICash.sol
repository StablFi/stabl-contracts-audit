// SPDX-License-Identifier: agpl-3.0
pragma solidity >=0.5.16;

interface ICash {
    enum RebaseOptions {
        NotSet,
        OptOut,
        OptIn
    }
    function rebaseOptIn() external;
    function rebaseState(address account) external view returns (RebaseOptions);
}
