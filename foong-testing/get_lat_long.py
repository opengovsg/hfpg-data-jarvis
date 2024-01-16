import requests
import pandas as pd

resale_df = pd.read_csv('ResaleflatpricesbasedonregistrationdatefromJan2017onwards.csv')

unique_street = resale_df['street_name'].unique()

schema = {'street_name': [], 'latitude': [], 'longitude': []}
lat_long_df = pd.DataFrame(schema)

count = 0
for street_name in unique_street:
    one_map_api = f'https://www.onemap.gov.sg/api/common/elastic/search?searchVal={street_name}&returnGeom=Y&getAddrDetails=Y&pageNum=1'
    response = requests.get(one_map_api)

    data = response.json()
    
    new_row = {'street_name': street_name, 'latitude': data['results'][0]['LATITUDE'], 'longitude': data['results'][0]['LONGITUDE']}
    print(new_row)
    lat_long_df = lat_long_df._append(new_row, ignore_index=True)
    
lat_long_df.to_csv('street_lat_long.csv')

# merged_df = pd.merge(resale_df, lat_long_df, on='street_name', how='left') 
# merged_df.to_csv('resale_flat_price_w_lat_long')