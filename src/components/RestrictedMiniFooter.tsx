import { HStack, Link, Text, VStack } from '@chakra-ui/react'
import NextLink from 'next/link'
import Image from 'next/image'

export const RestrictedMiniFooter = (): JSX.Element => {
  return (
    <VStack align="start">
      <Text
        display="flex"
        alignItems="center"
        whiteSpace="pre"
        lineHeight="1rem"
        fontWeight={500}
        letterSpacing="0.08em"
        textTransform="uppercase"
        fontSize="0.625rem"
      >
        Built by{' '}
        <Link as={NextLink} title="To OGP homepage" href="https://open.gov.sg">
          <Image
            src="/assets/restricted-ogp-logo-full.svg"
            width={233}
            height={12}
            alt="OGP Logo"
            priority
          />
        </Link>
      </Text>

      <HStack>
        <Link
          textStyle="caption-2"
          target="blank"
          href="https://docs.google.com/document/d/11FpLFhvtbP8Kv3qOCB2OjJgZdxzq-PI9/edit?usp=sharing&ouid=105551205084983073810&rtpof=true&sd=true"
        >
          Terms of use
        </Link>
        <Link
          textStyle="caption-2"
          target="blank"
          href="https://docs.google.com/document/d/11hW2F4Kq13XES4owgDEnbWpAftRpxY-5/edit?usp=sharing&ouid=105551205084983073810&rtpof=true&sd=true"
        >
          Privacy Policy
        </Link>
      </HStack>
    </VStack>
  )
}
