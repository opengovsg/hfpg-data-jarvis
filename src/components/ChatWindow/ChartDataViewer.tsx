import {
  Code,
  VStack,
  Button,
  Table,
  Tr,
  Td,
  Thead,
  Th,
  Tbody,
  TableContainer,
  ButtonGroup,
  Skeleton,
  Stack,
} from '@chakra-ui/react'
import { format } from 'sql-formatter'
import { IconButton } from '@opengovsg/design-system-react'
import { useCallback, useMemo, useState } from 'react'
import { BiChevronLeft, BiChevronRight, BiTerminal } from 'react-icons/bi'
import { v4 } from 'uuid'
import { trpc } from '~/utils/trpc'
import { useAtomValue } from 'jotai'
import { chartInfoAtom } from './chat-window.atoms'
import { Prose } from '@nikolovlazar/chakra-ui-prose'
import Suspense from '../Suspense'
import { ErrorBoundary } from 'react-error-boundary'
import { DefaultFallback } from '../ErrorBoundary'

export const ChartInfoLayout = ({
  messageId,
  generatedQuery,
}: {
  generatedQuery: string
  messageId: string
}) => {

  const chartInfo = useAtomValue(chartInfoAtom)
  console.log(chartInfo)

  return (
    <VStack w="full" align="start" spacing={4}>
      <VStack w="full" align="start" spacing={0}>
        {!!chartInfo?.question && (
          <Prose>
            <blockquote style={{ marginTop: 8, marginBottom: 8 }}>
              {chartInfo.question}
            </blockquote>
          </Prose>
        )}

      </VStack>

      <VStack w="full" align="center">
        <ErrorBoundary FallbackComponent={DefaultFallback}>
          <Suspense>
            {chartInfo}
          </Suspense>
        </ErrorBoundary>
      </VStack>
    </VStack>
  )
}

