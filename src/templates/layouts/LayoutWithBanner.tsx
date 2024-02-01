import { Flex, Text } from '@chakra-ui/react'
import { Banner, Link } from '@opengovsg/design-system-react'
import { EnforceLoginStatePageWrapper } from '~/components/AuthWrappers'
import { type GetLayout } from '~/lib/types'

export const LayoutWithBanner: GetLayout = (page) => {
  return (
    <EnforceLoginStatePageWrapper>
      <Flex h="$100vh" flexDir="column">
        <Banner variant="warn" isDismissable={true} size="sm">
          <Text>
            Watson is a work-in-progress Hackathon project for OGP&apos;s{' '}
            <Link href="https://hack.gov.sg/about-hfpg/hfpg/" target="_blank">
              Hack for Public Good
            </Link>
          </Text>
        </Banner>
        {page}
      </Flex>
    </EnforceLoginStatePageWrapper>
  )
}
