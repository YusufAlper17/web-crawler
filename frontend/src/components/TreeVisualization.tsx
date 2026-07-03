import { useEffect, useRef, useState } from 'react'
import * as d3 from 'd3'
import { TreeNode } from '../services/api'
import { Box, Paper, Typography, Chip, IconButton, Tooltip, Button } from '@mui/material'
import {
  ExpandMore,
  ExpandLess,
  Link as LinkIcon,
  CheckCircle,
  Home,
} from '@mui/icons-material'

interface TreeVisualizationProps {
  data: TreeNode
  onNodeSelect?: (node: TreeNode) => void
  selectedNodes?: Set<string>
  scrollToNodeId?: string | null
}

const TreeVisualization = ({
  data,
  onNodeSelect,
  selectedNodes = new Set(),
  scrollToNodeId,
}: TreeVisualizationProps) => {
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const nodeRefs = useRef<Map<string, { x: number; y: number }>>(new Map())
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set())
  const [dimensions, setDimensions] = useState({ width: 1200, height: 800 })
  const [isCollapsed, setIsCollapsed] = useState(false)
  const previousNodeCount = useRef<number>(0)

  // Tüm node'ları topla
  useEffect(() => {
    if (data) {
      const allNodeIds = new Set<string>()
      const collectIds = (node: TreeNode) => {
        allNodeIds.add(node.id)
        node.children.forEach(collectIds)
      }
      collectIds(data)
      setExpandedNodes(allNodeIds) // Başlangıçta tüm node'lar açık
    }
  }, [data])

  useEffect(() => {
    if (!svgRef.current || !data) return

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const width = dimensions.width
    const height = dimensions.height
    // Margin'leri artırarak daha fazla alan sağla
    const margin = { top: 60, right: 300, bottom: 60, left: 300 }

    const g = svg
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`)

    // Dikey tree layout (yukarıdan aşağıya)
    // Node'lar arası mesafeyi artırmak için separation kullan
    const tree = d3.tree<TreeNode>()
      .size([
        height - margin.top - margin.bottom,
        width - margin.left - margin.right
      ])
      .separation((a, b) => {
        // Kardeş node'lar arası mesafe
        return a.parent === b.parent ? 1.5 : 1.2
      })

    // Flatten tree with expanded nodes
    const flattenTree = (node: TreeNode): any => {
      const isExpanded = expandedNodes.has(node.id) && !isCollapsed
      const children = isExpanded && node.children.length > 0 ? node.children : []

      return {
        ...node,
        children: children.map((child) => flattenTree(child)),
      }
    }

    const root = d3.hierarchy(flattenTree(data))
    const treeData = tree(root)

    // Node pozisyonlarını sakla (scroll için)
    nodeRefs.current.clear()
    treeData.descendants().forEach((d) => {
      const node = d.data as TreeNode
      nodeRefs.current.set(node.id, { x: d.x, y: d.y })
    })

    // Zoom ve pan için
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 3])
      .on('zoom', (event) => {
        g.attr('transform', event.transform.toString())
      })

    svg.call(zoom as any)

    // Links - dikey için düz çizgiler
    g
      .selectAll('.link')
      .data(treeData.links())
      .enter()
      .append('path')
      .attr('class', 'link')
      .attr('d', (d) => {
        // Dikey için: x (yukarıdan aşağıya), y (soldan sağa)
        return `M${d.source.y},${d.source.x}L${d.target.y},${d.target.x}`
      })
      .attr('fill', 'none')
      .attr('stroke', '#6366f1')
      .attr('stroke-width', 2)
      .attr('opacity', 0.6)

    // Nodes
    const nodes = g
      .selectAll('.node')
      .data(treeData.descendants())
      .enter()
      .append('g')
      .attr('class', 'node')
      .attr('data-node-id', (d) => (d.data as TreeNode).id)
      .attr('transform', (d) => `translate(${d.y},${d.x})`)
      .style('cursor', 'pointer')

    // Node circles
    nodes
      .append('circle')
      .attr('r', (d) => {
        const node = d.data as TreeNode
        if (node.has_article) return 10
        if (node.children.length > 0) return 8
        return 6
      })
      .attr('fill', (d) => {
        const node = d.data as TreeNode
        if (selectedNodes.has(node.id)) return '#10b981'
        if (node.has_article) return '#ef4444'
        if (node.children.length > 0) return '#6366f1'
        return '#6b7280'
      })
      .attr('stroke', '#fff')
      .attr('stroke-width', 2.5)
      .on('click', (event, d) => {
        event.stopPropagation()
        const node = d.data as TreeNode
        if (onNodeSelect) {
          onNodeSelect(node)
        }

        // Node'a scroll yap (onNodeSelect çağrıldığında parent'tan scrollToNodeId gelecek)

        // Toggle expansion
        const newExpanded = new Set(expandedNodes)
        if (newExpanded.has(node.id)) {
          newExpanded.delete(node.id)
        } else {
          newExpanded.add(node.id)
        }
        setExpandedNodes(newExpanded)
      })
      .on('mouseover', function () {
        d3.select(this)
          .attr('r', (d: any) => {
            const node = d.data as TreeNode
            if (node.has_article) return 14
            if (node.children.length > 0) return 12
            return 8
          })
          .attr('stroke-width', 3)
      })
      .on('mouseout', function () {
        d3.select(this)
          .attr('r', (d: any) => {
            const node = d.data as TreeNode
            if (node.has_article) return 10
            if (node.children.length > 0) return 8
            return 6
          })
          .attr('stroke-width', 2.5)
      })

    // Node labels - dikey için
    nodes
      .append('text')
      .attr('dy', '.35em')
      .attr('x', 18)
      .attr('text-anchor', 'start')
      .text((d) => {
        const node = d.data as TreeNode
        const title = node.title || new URL(node.url).pathname || node.url
        // Daha uzun metin göster
        return title.length > 60 ? title.substring(0, 60) + '...' : title
      })
      .attr('fill', '#e0e0e0')
      .attr('font-size', '14px')
      .attr('font-family', 'sans-serif')
      .attr('font-weight', (d) => {
        const node = d.data as TreeNode
        return node.depth === 0 ? 'bold' : 'normal'
      })
      .on('click', (event, d) => {
        event.stopPropagation()
        const node = d.data as TreeNode
        if (onNodeSelect) {
          onNodeSelect(node)
        }
      })

    // Status indicators
    nodes
      .filter((d) => {
        const node = d.data as TreeNode
        return node.status_code !== undefined
      })
      .append('text')
      .attr('x', -15)
      .attr('y', -15)
      .attr('font-size', '10px')
      .text((d) => {
        const node = d.data as TreeNode
        return node.status_code ?? null
      })
      .attr('fill', (d) => {
        const node = d.data as TreeNode
        return node.status_code && node.status_code < 400 ? '#10b981' : '#ef4444'
      })

  }, [data, expandedNodes, dimensions, selectedNodes, onNodeSelect, isCollapsed])

  // Scroll to node effect
  useEffect(() => {
    if (!scrollToNodeId || !containerRef.current) return

    const nodePos = nodeRefs.current.get(scrollToNodeId)
    if (!nodePos) return

    const margin = { top: 60, right: 300, bottom: 60, left: 300 }
    const container = containerRef.current
    const nodeX = nodePos.y + margin.left
    const nodeY = nodePos.x + margin.top
    const scrollX = nodeX - container.clientWidth / 2
    const scrollY = nodeY - container.clientHeight / 2

    container.scrollTo({
      left: Math.max(0, scrollX),
      top: Math.max(0, scrollY),
      behavior: 'smooth',
    })

    // Node'u highlight et
    if (svgRef.current) {
      const svg = d3.select(svgRef.current)
      const nodeElement = svg.select(`g.node[data-node-id="${scrollToNodeId}"]`)
      if (nodeElement.size() > 0) {
        nodeElement
          .select('circle')
          .transition()
          .duration(300)
          .attr('r', 16)
          .transition()
          .duration(300)
          .attr('r', (d: any) => {
            const node = d.data as TreeNode
            if (node.has_article) return 10
            if (node.children.length > 0) return 8
            return 6
          })
      }
    }
  }, [scrollToNodeId])

  // Yeni node eklendiğinde otomatik scroll
  useEffect(() => {
    if (!data) return

    const countNodes = (node: TreeNode): number => {
      return 1 + node.children.reduce((sum, child) => sum + countNodes(child), 0)
    }
    const currentNodeCount = countNodes(data)

    if (currentNodeCount > previousNodeCount.current && previousNodeCount.current > 0) {
      // Son eklenen node'u bul
      const findLastNode = (node: TreeNode): TreeNode => {
        if (node.children.length === 0) return node
        return findLastNode(node.children[node.children.length - 1])
      }
      const lastNode = findLastNode(data)
      setTimeout(() => {
        if (lastNode) {
          // scrollToNodeId'yi set et (parent component'ten gelen prop)
          // Bu durumda parent'tan kontrol edilecek
        }
      }, 300)
    }
    previousNodeCount.current = currentNodeCount
  }, [data])

  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.offsetWidth,
          height: Math.max(800, containerRef.current.offsetHeight),
        })
      }
    }

    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const handleExpandAll = () => {
    const allNodeIds = new Set<string>()
    const collectIds = (node: TreeNode) => {
      allNodeIds.add(node.id)
      node.children.forEach(collectIds)
    }
    collectIds(data)
    setExpandedNodes(allNodeIds)
    setIsCollapsed(false)
  }

  const handleCollapseAll = () => {
    setExpandedNodes(new Set([data.id]))
    setIsCollapsed(true)
  }

  const handleResetView = () => {
    if (svgRef.current) {
      const svg = d3.select(svgRef.current)
      svg.transition()
        .duration(750)
        .call(
          d3.zoom<SVGSVGElement, unknown>().transform as any,
          d3.zoomIdentity
        )
    }
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2, alignItems: 'center' }}>
        <Typography variant="h6" fontWeight="bold">Link Ağacı</Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Tooltip title="Ana Node'a Dön">
            <Button
              size="small"
              variant="outlined"
              startIcon={<Home />}
              onClick={handleResetView}
            >
              Ana Node
            </Button>
          </Tooltip>
          <Tooltip title="Tümünü Genişlet">
            <IconButton size="small" onClick={handleExpandAll} color="primary">
              <ExpandMore />
            </IconButton>
          </Tooltip>
          <Tooltip title="Tümünü Daralt">
            <IconButton size="small" onClick={handleCollapseAll} color="primary">
              <ExpandLess />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>
      <Paper
        ref={containerRef}
        sx={{
          width: '100%',
          height: '800px',
          overflow: 'auto',
          bgcolor: 'background.paper',
          position: 'relative',
          border: '1px solid',
          borderColor: 'divider',
          scrollBehavior: 'smooth',
          '&::-webkit-scrollbar': {
            width: '12px',
            height: '12px',
          },
          '&::-webkit-scrollbar-track': {
            background: 'rgba(26, 31, 58, 0.4)',
            borderRadius: '6px',
          },
          '&::-webkit-scrollbar-thumb': {
            background: 'rgba(99, 102, 241, 0.5)',
            borderRadius: '6px',
            '&:hover': {
              background: 'rgba(99, 102, 241, 0.7)',
            },
          },
        }}
      >
        <svg
          ref={svgRef}
          width={Math.max(dimensions.width, 1600)}
          height={Math.max(dimensions.height, 1000)}
          style={{ display: 'block' }}
        />
      </Paper>
      <Box sx={{ mt: 2, display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
        <Typography variant="caption" color="text.secondary" sx={{ mr: 1 }}>
          Lejant:
        </Typography>
        <Chip
          icon={<CheckCircle />}
          label="Makale Var"
          size="small"
          sx={{ bgcolor: '#ef4444', color: 'white' }}
        />
        <Chip
          icon={<LinkIcon />}
          label="Alt Linkler Var"
          size="small"
          sx={{ bgcolor: '#6366f1', color: 'white' }}
        />
        <Chip
          label="Yaprak"
          size="small"
          sx={{ bgcolor: '#6b7280', color: 'white' }}
        />
        <Chip
          icon={<CheckCircle />}
          label="Seçili"
          size="small"
          sx={{ bgcolor: '#10b981', color: 'white' }}
        />
        <Typography variant="caption" color="text.secondary" sx={{ ml: 2 }}>
          Zoom için scroll, pan için sürükle
        </Typography>
      </Box>
    </Box>
  )
}

export default TreeVisualization
