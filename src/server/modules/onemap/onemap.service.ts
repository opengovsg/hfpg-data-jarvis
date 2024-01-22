import { z } from 'zod'
import QueryStringAddon from 'wretch/addons/queryString'
import wretch from 'wretch'
import { AddressNotFoundError } from './onemap.errors'

export const OneMapResponseSchema = z.object({
  found: z.number(),
  results: z.array(
    z.object({
      SEARCHVAL: z.string(),
      BLK_NO: z.string(),
      ROAD_NAME: z.string(),
      BUILDING: z.string(),
      ADDRESS: z.string(),
      POSTAL: z.string(),
      X: z.string(),
      Y: z.string(),
      LATITUDE: z.coerce.number(),
      LONGITUDE: z.coerce.number(),
    }),
  ),
})

export type OneMapResponse = z.infer<typeof OneMapResponseSchema>

export const oneMapClient = wretch('https://www.onemap.gov.sg/api').addon(
  QueryStringAddon,
)

/** Returns the first matching result for any search string from onemap.
 *
 * throw AddressNotFoundError if no results returned
 */
export const bestGuessAddressDetailsFromOneMap = async (searchVal: string) => {
  const res = await oneMapClient
    .query({ searchVal, returnGeom: 'Y', getAddrDetails: 'Y' })
    .get('/common/elastic/search')
    .json<OneMapResponse>()

  const parsedRes = OneMapResponseSchema.parse(res)

  if (parsedRes.results.length === 0) {
    throw new AddressNotFoundError(searchVal)
  }

  // just return the first address and assume its the best match
  return parsedRes.results[0]!
}
