{{baseUrl}}/ride-types?category=ride use this to fetch the price, the response looks liek this 
{
    "currency": "JMD",
    "rideTypes": [
        {
            "id": "69d6c53a30f8268f4432a973",
            "name": "XLCAB GO",
            "slug": "xlcab-go",
            "category": "ride",
            "seatCapacity": 4,
            "baseFare": 360,
            "perKm": 90,
            "perMinute": 21,
            "minimumFare": 350,
            "promoPercentOff": 10
        },
        {
            "id": "69d6c53a30f8268f4432a976",
            "name": "XLCAB GREEN",
            "slug": "xlcab-green",
            "category": "ride",
            "seatCapacity": 4,
            "baseFare": 420,
            "perKm": 98,
            "perMinute": 23,
            "minimumFare": 400,
            "promoPercentOff": 0
        },
        {
            "id": "69d6c53a30f8268f4432a977",
            "name": "XLCAB POOL",
            "slug": "xlcab-pool",
            "category": "ride",
            "seatCapacity": 4,
            "baseFare": 310,
            "perKm": 76,
            "perMinute": 18,
            "minimumFare": 300,
            "promoPercentOff": 0
        }
    ]
}
{{baseUrl}}/rides/estimate
{
    "currency": "JMD",
    "subtotal": 1542,
    "total": 1388,
    "discountAmount": 154,
    "baseTariff": 1251,
    "pickupZone": "hotel",
    "dropoffZone": "hotel",
    "zonePremium": 291,
    "zoneSummary": "Hotel area · +291 JMD premia",
    "rideType": {
        "id": "69d6c53a30f8268f4432a973",
        "slug": "xlcab-go",
        "name": "XLCAB GO",
        "seatCapacity": 4,
        "promoPercentOff": 10
    },
    "zones": {
        "pickup": "hotel",
        "dropoff": "hotel",
        "pickupLabel": "Hotel district (New Kingston area)",
        "dropoffLabel": "Hotel district (New Kingston area)"
    }
}

the body {
  "rideTypeSlug": "xlcab-go",
  "distanceKm": 6.2,
  "durationMinutes": 18,
  "insurance": false,
  "pickup": {
    "address": "Half Way Tree Road, Kingston",
    "lat": 18.0125,
    "lng": -76.7994
  },
  "dropoff": {
    "address": "Waterfront, Downtown Kingston",
    "lat": 18.007,
    "lng": -76.792
  }
}

@Ridr-API.postman_collection.json where i get the stuff from. use this, make sur eu take airports and urban areas into concideration etc, 