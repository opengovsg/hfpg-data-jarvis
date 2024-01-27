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
import { tableInfoAtom } from './chat-window.atoms'
import { Prose } from '@nikolovlazar/chakra-ui-prose'
import Suspense from '../Suspense'
import { ErrorBoundary } from 'react-error-boundary'
import { DefaultFallback } from '../ErrorBoundary'

export const TableInfoLayout = ({
  messageId,
  generatedQuery,
}: {
  generatedQuery: string
  messageId: string
}) => {
  const [offset, setOffset] = useState(0)

  const handleClickChevron = useCallback(
    async ({ offset }: { offset: number }) => {
      setOffset(offset)
    },
    [],
  )

  const tableInfo = useAtomValue(tableInfoAtom)

  const [isSqlViewable, setIsSqlViewable] = useState(false)

  return (
    <VStack w="full" align="start" spacing={4}>
      <VStack w="full" align="start" spacing={0}>
        {!!tableInfo?.question && (
          <Prose>
            <blockquote style={{ marginTop: 8, marginBottom: 8 }}>
              {tableInfo.question}
            </blockquote>
          </Prose>
        )}

        <Button
          p={0}
          variant="clear"
          onClick={() => setIsSqlViewable((prev) => !prev)}
          size="xs"
          leftIcon={<BiTerminal />}
        >
          <code>{isSqlViewable ? `Hide` : `View`} SQL</code>
        </Button>
      </VStack>

      {isSqlViewable && (
        <pre style={{ width: '100%' }}>
          <Code
            bgColor="base.content.strong"
            color="gray.100"
            p={4}
            width="100%"
            borderRadius={4}
            style={{ overflowX: 'scroll' }}
          >
            {format(generatedQuery, {
              tabWidth: 4,
              language: 'postgresql',
            })}
          </Code>
        </pre>
      )}

      <VStack w="full" align="center">
        <ErrorBoundary FallbackComponent={DefaultFallback}>
          <Suspense fallback={<SkeletonTable />}>
            <TableView
              messageId={String(messageId)}
              offset={offset}
              handleClickChevron={handleClickChevron}
            />
          </Suspense>
        </ErrorBoundary>
      </VStack>
    </VStack>
  )
}

const SkeletonTable = () => {
  return (
    <Stack w="full" align="center">
      {[...Array(10)].map((val) => (
        <Skeleton height="33px" w="full" key={val} />
      ))}

      <ButtonGroup>
        <IconButton
          aria-label="left"
          icon={<BiChevronLeft />}
          size="xs"
          variant="clear"
          isDisabled
        />
        <IconButton
          aria-label="right"
          icon={<BiChevronRight />}
          size="xs"
          variant="clear"
          isDisabled
        />
      </ButtonGroup>
    </Stack>
  )
}

const TableView = ({
  offset,
  messageId,
  handleClickChevron,
}: {
  offset: number
  messageId: string
  handleClickChevron: (data: { offset: number }) => Promise<void>
}) => {
  const [{ data, hasNext }] = trpc.watson.getTable.useSuspenseQuery({
    limit: 10,
    offset,
    messageId: Number(messageId),
  })

  const columnNames = useMemo(() => {
    return Object.keys(data[0]!)
  }, [data])

  const dataWithId = useMemo(
    () => data.map((row) => ({ rowData: row, uniqueId: v4() })),
    [data],
  )

  return (
    <VStack w="full" align="center">
      <TableContainer w="full">
        <Table size="sm" variant="simple">
          <Thead>
            <Tr>
              {columnNames.map((col) => (
                <Th key={col} textTransform="capitalize">
                  {col.replaceAll('_', ' ')}
                </Th>
              ))}
            </Tr>
          </Thead>

          <Tbody>
            {dataWithId.map((r) => (
              <Tr key={r.uniqueId}>
                {columnNames.map((col) => (
                  <Td key={`${r.uniqueId} ${col}`}>{String(r.rowData[col])}</Td>
                ))}
              </Tr>
            ))}
          </Tbody>
        </Table>
      </TableContainer>

      <ButtonGroup>
        <IconButton
          aria-label="left"
          icon={<BiChevronLeft />}
          size="xs"
          variant="clear"
          isDisabled={offset === 0}
          onClick={async () => await handleClickChevron({ offset: offset - 1 })}
        />
        <IconButton
          aria-label="right"
          onClick={async () => await handleClickChevron({ offset: offset + 1 })}
          icon={<BiChevronRight />}
          size="xs"
          variant="clear"
          isDisabled={!hasNext}
        />
      </ButtonGroup>
    </VStack>
  )
}
