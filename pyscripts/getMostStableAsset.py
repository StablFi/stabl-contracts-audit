#  /**
#      * @dev Function to get the index of most stable asset using Oracle
#      */
#     function getMostStableAssetIndex() view internal returns (uint256) {
#         // Loop through all assets and find the one with price most close to 10**8
#         uint256 _mostStableAssetIndex = 0;
#         uint256 _leastDifference = 1000000000; // 10 USD - Stable coin max cannot reach $10
#         uint256 _mostStableAssetPrice = 10**8;
#         for (uint8 i; i < allAssets.length; i++) {
#             uint256 _price = IOracle(priceProvider).price(allAssets[i]);
#             if (_price.subFromBigger(_mostStableAssetPrice) < _leastDifference) {
#                 _mostStableAssetIndex = i;
#                 _mostStableAssetPrice = _price;
#                 _leastDifference = _price.subFromBigger(_mostStableAssetPrice);
#             }
#         }
#         return _mostStableAssetIndex;
#     }


_mostStableAssetIndex = 0;
_leastDifference = float(1000000000);
_mostStableAssetPrice = 10**8;

def subFromBigger(a, b):
    if (b > a):
        return b - a
    return a - b

prices = [99990000, 99980000, 11000000]

closest_index = 0
_leastDifference = 1000000000
for i, price in enumerate(prices):
    diff = subFromBigger(price , _mostStableAssetPrice)
    if diff < _leastDifference:
        closest_index = i
        _leastDifference = diff

print("Index of the price closest to 10^8:", closest_index, prices[closest_index])