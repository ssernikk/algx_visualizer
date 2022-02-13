import './AlgVis.css'
import { JSXElement, Component, For, createSignal, onMount } from 'solid-js';


type AniProp = {
  dn?: (r: number, c: number) => void,
  dl?: (r1: number, c1: number, r2: number, c2: number) => void
};

const AniButton: Component<any> = (props: any) => {

  const onDN = (event: MouseEvent) => {
    props.dn(3, 1);
  };

  const onDL = (event: MouseEvent) => {
    props.dl(1,1,2,2);
  };

  return(
    <div>
      <button onClick={onDN}>dn</button>
      <button onClick={onDL}>dl</button>
    </div>
  )
};

const AlgxAnimator: Component<any> = (props: any): JSXElement => {
  const nodeSize = 12;
  const linkLen = 12;
  const gridSize = nodeSize + linkLen
  const width = 10 * gridSize;
  const height = 6 * gridSize;
  let canvas: any;
  let context: CanvasRenderingContext2D;
  onMount(() => {
    context = canvas.getContext('2d');
  });

  const drawNode = (r: number, c: number) => {
    context.fillRect(c*gridSize, r*gridSize, nodeSize, nodeSize)
  }

  const drawLink = (r1: number, c1: number, r2: number, c2: number) => {
    console.log('dl click')
  }

  props.dn = drawNode;
  props.dl = drawLink;

  return(
    <canvas ref={canvas} width={width} height={height}/>
  )
}


export { AlgxAnimator, AniButton, AniProp };
