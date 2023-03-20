// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;


library Array {

    function diff(address[] memory arr1, address[] memory arr2) internal pure returns (address[] memory) {
        address[] memory result = new address[](arr1.length);
        uint count = 0;
        for (uint i = 0; i < arr1.length; i++) {
            bool found = false;
            for (uint j = 0; j < arr2.length; j++) {
                if (arr1[i] == arr2[j]) {
                    found = true;
                    break;
                }
            }
            if (!found) {
                result[count] = arr1[i];
                count++;
            }
        }
        address[] memory result2 = new address[](count);
        for (uint i = 0; i < count; i++) {
            result2[i] = result[i];
        }
        return result2;
    }

    function diff(uint256[] memory arr1, uint256[] memory arr2) internal pure returns (uint256[] memory) {
        uint256[] memory result = new uint256[](arr1.length);
        uint count = 0;
        for (uint i = 0; i < arr1.length; i++) {
            bool found = false;
            for (uint j = 0; j < arr2.length; j++) {
                if (arr1[i] == arr2[j]) {
                    found = true;
                    break;
                }
            }
            if (!found) {
                result[count] = arr1[i];
                count++;
            }
        }
        uint256[] memory result2 = new uint256[](count);
        for (uint i = 0; i < count; i++) {
            result2[i] = result[i];
        }
        return result2;
    }

}