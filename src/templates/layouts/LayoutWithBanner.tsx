import { Flex, Grid, Text } from '@chakra-ui/react'
import { Banner, Link } from '@opengovsg/design-system-react'
import { EnforceLoginStatePageWrapper } from '~/components/AuthWrappers'
import { type GetLayout } from '~/lib/types'

export const LayoutWithBanner: GetLayout = (page) => {
  return (
    <EnforceLoginStatePageWrapper>
      <Flex minH="$100vh" flexDir="column" bg="base.canvas.alt" pos="relative">
        <Grid
          flex={1}
          width="100vw"
          h="$100vh"
          gridColumnGap={{ base: 0, md: '1rem' }}
          gridTemplateRows={'min-content 1fr'}
        >
          <Banner isDismissable={true} variant="warn">
            <Text>
              Watson is a work-in-progress Hackathon project for OGP&apos;s{' '}
              <Link href="https://hack.gov.sg/about-hfpg/hfpg/" target="_blank">
                Hack for Public Good
              </Link>
            </Text>
          </Banner>
          {page}
        </Grid>
      </Flex>
    </EnforceLoginStatePageWrapper>
  )
}
