import React, { useRef, useEffect, useState, useContext } from "react";
import * as d3 from "d3";
import './GlobeMap.css'; 
import { Routes } from "gatsby-theme-ceteicean/src/components/Ceteicean";
import Graphic from "../gatsby-theme-ceteicean/components/Graphic";
import { Ref, SafeUnchangedNode } from "gatsby-theme-ceteicean/src/components/DefaultBehaviors";
import { Box, Typography } from "@mui/material";
import Renderer from "gatsby-theme-ceteicean/src/components/Renderer";
import Q from "../gatsby-theme-ceteicean/components/Q";
import { DisplayContext, EntityContext, IOptions, TEntity } from "../gatsby-theme-ceteicean/components/Context";
import Entity from "../gatsby-theme-ceteicean/components/Entity";
import { Lang } from "./nav";

interface GlobeMapProps {
  geojson: any; 
  language: "en" | "fr";
  elements: string[];
  prefixed: string;
}

const GlobeMap: React.FC<GlobeMapProps> = ({ geojson, elements, prefixed, language }) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  let isRotationStopped = false; // Flag to track if rotation should be stopped
  const [entity, setEntity] = useState<TEntity | null>(null); 
  
  useEffect(() => {
    if (!svgRef.current || !geojson) return;

    const svg = d3.select(svgRef.current);
    const width = 800;
    const height = 800;
    const sensitivity = 75;
    const minZoom = 0.3;

    let projection = d3.geoOrthographic()
      .scale(width / 2)
      .center([0, 0])
      .rotate([0, -30])
      .translate([width / 2, height / 2]);

    const initialScale = projection.scale();
    const path = d3.geoPath().projection(projection);

    svg.attr("width", width).attr("height", height);

    // Light blue sea
    svg.append("circle")
      .attr("fill", "#d0e7f9")
      .attr("stroke", "#000")
      .attr("stroke-width", 3)
      .attr("cx", width / 2)
      .attr("cy", height / 2)
      .attr("r", initialScale)
      .attr("class", "globe");

    // Drag behavior
    const dragBehavior = d3.drag<SVGSVGElement, unknown>()
      .on('start', () => {
        isRotationStopped = true; // Stop the globe from rotating permanently after first interaction
        
      })
      .on('drag', (event: d3.D3DragEvent<SVGSVGElement, unknown, unknown>) => {
        const rotate = projection.rotate();
        const k = sensitivity / projection.scale();
        projection.rotate([
          rotate[0] + event.dx * k,
          rotate[1] - event.dy * k
        ]);

        // Update map paths
        svg.selectAll("path").attr("d", (d: any) => path(d));

        updatePins();
      });

    // Zoom behavior
    const zoomBehavior = d3.zoom<SVGSVGElement, unknown>()
      .on('zoom', (event: d3.D3ZoomEvent<SVGSVGElement, unknown>) => {
        if (event.transform.k > minZoom) {
          // Update projection scale
          projection.scale(initialScale * event.transform.k);

          // Update map paths
          svg.selectAll("path").attr("d", (d: any) => path(d));

          // Update globe circle radius
          svg.select(".globe").attr("r", projection.scale());

          // Update pin positions
          updatePins();
        }
      });

    svg.call(dragBehavior).call(zoomBehavior);

    // Load and render map data
    const loadData = async () => {
      const mapResponse = await fetch("/earth-coastlines-10km.geojson");
      const mapData = await mapResponse.json();
      const geometries = mapData.geometries.filter((d: any) => d.type === "MultiPolygon")
      svg.append("g")
        .attr("class", "multipolygons")
        .selectAll("path")
        .data(geometries)
        .enter().append("path")
        .attr("d", (d: any) => path(d))
        .attr("fill", "lightgray")
        .style('stroke', 'black')
        .style('stroke-width', 1)
        .style("opacity", 0.8);
    };

    const pinWidth = 40;  
    const pinHeight = 40; 

    // Render the geojson data
    const loadGeojsonData = async () => {
      if (geojson.features) {
        const polygons = geojson.features.filter((d: any) => d.geometry.type === "Polygon");

        svg.append("g")
          .attr("class", "polygons")
          .selectAll("path")
          .data(polygons)
          .enter().append("path")
          .attr("d", (d: any) => path(d))
          .attr("fill", "none")
          .attr("stroke", "blue")
          .style('stroke-width', 2)
          .attr("stroke-dasharray", "5,5")
          .style("opacity", 1);

        const points = geojson.features.filter((d: any) => d.geometry.type === "Point");          
        // Add pins
        svg.selectAll("image.point-pin")
          .data(points)
          .enter()
          .append("image")
          .attr("class", "point-pin")
          .attr("href", "/pin.svg")
          .attr("width", pinWidth)
          .attr("height", pinHeight)
          .attr("transform", (d: any) => {
            return `translate(${projection(d.geometry.coordinates)})`
          })
          .on("click", (event, d) => {
            setEntity({ id: d.properties.id });
          })
          .raise();
       
        svg.selectAll("image.polygon-pin")
          .data(polygons)
          .enter()
          .append("image")
          .attr("class", "polygon-pin")
          .attr("href", "/pin.svg")
          .attr("width", pinWidth)
          .attr("height", pinHeight)
          .attr("transform", (d: any) => {
            let coords = d3.polygonCentroid(d.geometry.coordinates[0]);
            return `translate(${projection(coords)})`
          })
          .on("click", (event, d) => {
            setEntity({ id: d.properties.id }); 
          })
          .raise();
      }
    };
    
    loadData();
    loadGeojsonData();

    const updatePins = () => {
      svg.selectAll("image.point-pin")
        .attr("transform", (d: any) => {
          const coords = projection(d.geometry.coordinates);
          
          // Hide pins on the far side of the globe
          const visible = d3.geoDistance(projection.invert([width / 2, height / 2]), d.geometry.coordinates) < Math.PI / 2;
          
          if (visible && coords) {
            // If visible, show the pin and place it correctly
            return `translate(${coords[0] - pinWidth / 2}, ${coords[1] - pinHeight})`;
          } else {
            // Hide the pin by translating it far off-screen
            return `translate(-9999, -9999)`;
          }
        }).raise();

        svg.selectAll("image.polygon-pin")
        .attr("transform", (d: any) => {
          const coords = projection(d3.polygonCentroid(d.geometry.coordinates[0]));
          
          // Hide pins on the far side of the globe
          const visible = d3.geoDistance(projection.invert([width / 2, height / 2]), d3.polygonCentroid(d.geometry.coordinates[0])) < Math.PI / 2;
          
          if (visible && coords) {
            // If visible, show the pin and place it correctly
            return `translate(${coords[0] - pinWidth / 2}, ${coords[1] - pinHeight})`;
          } else {
            // Hide the pin by translating it far off-screen
            return `translate(-9999, -9999)`;
          }
        }).raise();
    };
    
    // Optional rotation function
    const rotateGlobe = () => {
      if (!isRotationStopped) {
        const rotate = projection.rotate();
        const k = sensitivity / projection.scale();
        projection.rotate([rotate[0] - 1 * k, rotate[1]]);

        // Update the map paths
        svg.selectAll("path").attr("d", (d: any) => path(d));

        updatePins();
      }
    };

    const timer = d3.timer(rotateGlobe, 200);

    // Stop rotation on first user interaction
    const stopRotationOnFirstInteraction = () => {
      svg.on("mousedown touchstart", () => {
        isRotationStopped = true;
        timer.stop(); // Stop rotation permanently after first interaction
      });
    };

    stopRotationOnFirstInteraction();

  }, [geojson]);

  type TEIProps = {
    teiNode: Node,
    availableRoutes?: string[],
  }
  const lang = language as Lang
  const startOpts: IOptions = {annosLang: lang, originalSpelling: false}
  const [displayOpts, setDisplayOpts] = React.useState(startOpts)
  
  const Title = (props: TEIProps) => <Typography variant="h3" component="h1" gutterBottom={false} sx={{
    marginBottom: "2rem"
  }}><SafeUnchangedNode {...props}/></Typography>
  const routes: Routes = {
    "tei-graphic": (props) => <Box sx={{textAlign: "center"}}><Graphic {...props}/></Box>,
    "tei-ref": Ref,
    "tei-q": (props) => <Q {...props} curLang={language}/>,
    "tei-placename": Title,
    "tei-title": (props) => {
      const el = props.teiNode as Element
      return el.parentElement?.getAttribute("type") === "periodical" ? <Title {...props}/>
      : <SafeUnchangedNode {...props}/>
    },
    // "tei-note": (props) => {
    //   const el = props.teiNode as Element
    //   if (el.getAttribute("xml:lang") === language) {
    //     return <SafeUnchangedNode {...props}/>
    //   }
    //   return null
    // },
    "tei-place": (props) => <Entity isSynoptic={false} entityType={"tei-placeName"} {...props} />,
  }
  


  return (
    <div className="globe-container">
        <Typography variant="h4" component="h2" gutterBottom={false} sx={{
          marginBottom: "1rem", marginTop: "2rem"
        }}>{
          language === "fr" ? "Carte du monde"
          : "Global Map Visualization"
        }</Typography>
      <div className="map-container">
        <div className="visualization-content">
          <svg ref={svgRef}></svg>
          <div className="note-container">
            <DisplayContext.Provider value={{
              contextOpts: displayOpts,
              setContextOpts: setDisplayOpts
            }}>
            <EntityContext.Provider value={{ entity, setEntity }}>
              <Renderer name="mapnote" prefixed={prefixed} elements={elements} routes={routes} />
            </EntityContext.Provider>
          </DisplayContext.Provider>
          </div>
        </div>
      </div>
    </div>

  );
};

export default GlobeMap;


