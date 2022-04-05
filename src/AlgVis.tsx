import './AlgVis.css'
import { AlgXMatrix, AlgXNode, buildSudMatrix, buildTest, decodeSolution } from './AlgX';
import { JSXElement, Component, createSignal, createEffect, onMount } from 'solid-js';


type NodeDrawInfo = { row: number, col: number, focused: boolean, covered: boolean, solution: boolean };
type LinkDrawInfo = {
  dir: 'up' | 'down' | 'left' | 'right',
  draw: boolean, //enable drawing flag
  animating: boolean, //link is currently animating
  reverse: boolean, //'unlink' animation is occuring
  pct: number, //percent animation complete
  start: number | null//TODO - needed for constant line drawing speed?
};

const AlgXAnimator: Component<any> = (props: any): JSXElement => {
  //hardcoded vars for visualization size
  const nodeSize = 9;
  const lineWidth = 1;
  const linkLen = nodeSize*3;
  const gridSize = nodeSize + linkLen
  const nodeColor = '#000000';
  const nodeCoveredColor = '#CCCCCC';
  const nodeFocusedColor = '#FFFF00';
  const nodeSolutionColor = '#00FF00';
  const linkColor = '#FF0000';
  const linkCoveredColor = '#CCCCCC';
  const animationStep = 3;
  const animationConstWaitTime = 1000/animationStep;
  //component state and reference variables
  let canvas: any;
  let context: CanvasRenderingContext2D;
  let animationComplete: any | null = null;
  let stepComplete: any | null = null;
  let stepMode: boolean = false;
  //solidjs reactive signals to update size of canvas
  const [getWidth, setWidth] = createSignal(0);
  const [getHeight, setHeight] = createSignal(0);


  //testing only - getMatrix needs to be passed in as a prop from the user interactive portion
  const [getMatrix, setMatrix] = createSignal(buildTest());


  //reactively set canvas size based on matrix size
  const initCanvas = (): void => {
    setWidth(gridSize * getMatrix().cols.length + gridSize*10);
    setHeight(gridSize * getMatrix().rows.length + gridSize*10);
  };

  //solidjs effect - this causes initCanvas to run anytime a solidjs signal used by initCanvas (getMatrix) changes
  createEffect(() => {
    initCanvas();
  });

  //solidjs built-in effect, runs one time after the first render of this component
  onMount(() => {
    initCanvas();
    context = canvas.getContext('2d');
    updateCanvas();
  });

  //canvas main loop - draws and animates the matrix on the canvas
  const updateCanvas = (): void => {
    updateAnimationStatus();
    drawMatrix();
    requestAnimationFrame(updateCanvas);
  };

  //resolves animationComplete Promise if no animation is happening
  const updateAnimationStatus = (): void => {
    if(animationComplete === null) { return; }
    //check if any link is currently animating
    const animating = getMatrix().allNodeMap((node: AlgXNode): boolean => {
      for(const link of Object.values(node.linkInfo)){
        if(link.animating){ return true; }
      }
      return false;
    });
    
    if(animating){ return; }
    animationComplete.resolve(true);
  };

  const drawMatrix = (): void => {
    context.clearRect(0, 0, getWidth(), getHeight());
    context.save()
    context.translate(5*gridSize, 5*gridSize);
    //draw each node
    getMatrix().allNodeMap((node: AlgXNode): void => {
      drawNode(node.nodeInfo);
    });
    //draw all 4 links of each node
    context.beginPath()
    context.strokeStyle = linkColor;
    context.lineWidth = lineWidth;
    getMatrix().allNodeMap((node: AlgXNode): void => {
      drawLink(node.linkInfo.up, node.nodeInfo, node.up.nodeInfo);
      drawLink(node.linkInfo.down, node.nodeInfo, node.down.nodeInfo);
      drawLink(node.linkInfo.left, node.nodeInfo, node.left.nodeInfo);
      drawLink(node.linkInfo.right, node.nodeInfo, node.right.nodeInfo);
    });
    context.stroke();
    context.restore();
  };

  const drawNode = (node: NodeDrawInfo):void => {
    context.fillStyle = nodeColor;
    if(node.covered){ context.fillStyle = nodeCoveredColor; }
    if(node.focused){ context.fillStyle = nodeFocusedColor; }
    if(node.solution){ context.fillStyle = nodeSolutionColor; }
    context.beginPath();
    context.arc(node.col * gridSize + nodeSize/2, node.row * gridSize + nodeSize/2, nodeSize/2, 0, 2*Math.PI);
    context.fill();
    context.strokeStyle = nodeColor;
    context.beginPath();
    context.arc(node.col * gridSize + nodeSize/2, node.row * gridSize + nodeSize/2, nodeSize/2, 0, 2*Math.PI);
    context.stroke();
  };

  //draw link from n1 to n2
  const drawLink = (link: LinkDrawInfo, n1: NodeDrawInfo, n2: NodeDrawInfo):void => {
    if(!link.draw){ return; }

    //update link pct
    if(!link.reverse){
      link.pct = link.pct + animationStep >= 100 ? 100 : link.pct + animationStep;
    }
    else{
      link.pct = link.pct - animationStep <= 0 ? 0 : link.pct - animationStep;
    }
    let wrapping: boolean; //determine if link wraps around matrix
    let x: number;
    let y: number;
    let currentLength: number; //amount of link to draw this frame
    let line1Length: number; //distance between 2 nodes - or distance from node to edge of matrix if wrapping
    let line2Length: number; //used for drawing the second line if the link wraps

    //draw link in corresponding direction
    switch(link.dir){
      case 'up':
        wrapping = n2.row > n1.row;
        //determine line lengths
        line1Length = wrapping ? gridSize*n1.row + 1.5*gridSize : (n1.row - n2.row) * gridSize - nodeSize;
        line2Length = wrapping ? gridSize*(getMatrix().rows.length - n2.row) - 0.5*gridSize: 0;
        currentLength = (line1Length + line2Length) * link.pct/100;
        //move to top of node and draw the current length of link upward
        [x,y] = nodeTop(n1);
        context.moveTo(x, y);
        context.lineTo(x, y - (currentLength < line1Length ? currentLength : line1Length));
        //draw second line if wrapping
        if(currentLength > line1Length && wrapping){
          currentLength -= line1Length; //remove already drawn portion of length
          //move to bottom of matrix and draw remainder of link towards node 2
          [x,y] = nodeBottom(n2);
          y += line2Length;
          context.moveTo(x, y);
          context.lineTo(x, y - currentLength);
        }
        break;
      
      case 'down':
        wrapping = n2.row < n1.row;
        //determine line lengths
        line1Length = wrapping ? gridSize*(getMatrix().rows.length - n1.row) - 0.5*gridSize: (n2.row - n1.row) * gridSize - nodeSize;
        line2Length = wrapping ? gridSize*n2.row + 1.5*gridSize : 0;
        currentLength = (line1Length + line2Length) * link.pct/100;
        //move to bottom of node and draw the current length of link downward
        [x,y] = nodeBottom(n1);
        context.moveTo(x, y);
        context.lineTo(x, y + (currentLength < line1Length ? currentLength : line1Length));
        //draw second line for wrapping
        if(currentLength > line1Length && wrapping){
          currentLength -= line1Length; //remove already drawn portion of length
          //move to top of matrix and draw remainder of link towards node 2
          [x,y] = nodeTop(n2);
          y -= line2Length;
          context.moveTo(x, y);
          context.lineTo(x, y + currentLength);
        }
        break;
      
      case 'left':
        wrapping = n2.col > n1.col;
        //determine line lengths
        line1Length = wrapping ? gridSize*n1.col + 1.5*gridSize : (n1.col - n2.col) * gridSize - nodeSize;
        line2Length = wrapping ? gridSize*(getMatrix().cols.length - n2.col) - 0.5*gridSize : 0;
        currentLength = (line1Length + line2Length) * link.pct/100;
        //move to left of node and draw the current length of link leftward
        [x,y] = nodeLeft(n1);
        context.moveTo(x, y);
        context.lineTo(x - (currentLength < line1Length ? currentLength : line1Length), y);
        //draw second line for wrapping
        if(currentLength > line1Length && wrapping){
          currentLength -= line1Length; //remove already drawn portion of length
          //move to right of matrix and draw remainder of link towards node 2
          [x,y] = nodeRight(n2);
          x += line2Length;
          context.moveTo(x, y);
          context.lineTo(x - currentLength, y);
        }
        break;
      
      case 'right':
        wrapping = n2.col < n1.col;
        //determine line lengths
        line1Length = wrapping ? gridSize*(getMatrix().cols.length - n1.col) - 0.5*gridSize: (n2.col - n1.col) * gridSize - nodeSize;
        line2Length = wrapping ? gridSize*n2.col + 1.5*gridSize : 0;
        currentLength = (line1Length + line2Length) * link.pct/100;
        //move to right of node and draw the current length of link rightward
        [x,y] = nodeRight(n1);
        context.moveTo(x, y);
        context.lineTo(x + (currentLength < line1Length ? currentLength : line1Length), y);
        //draw second line for wrapping
        if(currentLength > line1Length && wrapping){
          currentLength -= line1Length; //remove already drawn portion of length
          //move to left of matrix and draw remainder of link towards node 2
          [x,y] = nodeLeft(n2);
          x -= line2Length;
          context.moveTo(x, y);
          context.lineTo(x + currentLength, y);
        }
        break;
      default:
    }

    //update link state variables
    if(!link.reverse && link.pct >= 100){
      link.animating = false; 
      link.draw = true;
      link.pct = 100;
    }
    else if(link.reverse && link.pct <= 0){
      link.animating = false;
      link.pct = 0;
      link.reverse = false;
    }
    if(link.pct === 0){
      link.draw = false; //don't draw links that have been retracted
    }
  };

  //translates matrix position to a tuple of canvas coordinates of a node
  const nodeCenter = (node: NodeDrawInfo): [number, number] => {
    return [node.col*gridSize + nodeSize/2, node.row*gridSize + nodeSize/2];
  };
  const nodeTop = (node: NodeDrawInfo): [number, number] => {
    return [node.col*gridSize + nodeSize/2, node.row*gridSize];
  };
  const nodeBottom = (node: NodeDrawInfo): [number, number] => {
    return [node.col*gridSize + nodeSize/2, node.row*gridSize + nodeSize];
  };
  const nodeLeft = (node: NodeDrawInfo): [number, number] => {
    return [node.col*gridSize, node.row*gridSize + nodeSize/2];
  };
  const nodeRight = (node: NodeDrawInfo): [number, number] => {
    return [node.col*gridSize + nodeSize, node.row*gridSize + nodeSize/2];
  };

  //button callbacks
  const solveCB = async (event: MouseEvent): Promise<void> => {
    let puzzle: Array<number> = [];
    for(const cell of props.boardState){
      puzzle.push(cell.getValue());
    }
    setMatrix(buildSudMatrix(puzzle));
    for(const update of getMatrix().animatedAlgXSearch()){
      await new Promise(r => setTimeout(r, 50));
    }
  };
  const testCB = async (event: MouseEvent): Promise<void> => {
    setMatrix(buildTest());
    for(const update of getMatrix().animatedAlgXSearch()){
      if(update === 0 || stepMode){ //no timeout specified - wait for animator to finish this step
        await (animationComplete = getExposedPromise());
        animationComplete = null;
      }
      else{ //wait for a set time instead of the animator before continuing
        await new Promise((resolve) => {setTimeout(resolve, (update/100)*animationConstWaitTime)});
      }
      if(stepMode){
        await (stepComplete = getExposedPromise());
        stepComplete = null;
      }
    }
    console.log(getMatrix().solution)
  };
  const stepCB = (event: MouseEvent): void => {
    if(stepComplete !== null){ stepComplete.resolve(true); }
  };
  const enableStepModeCB = (event: MouseEvent): void => {
    stepMode = stepMode ? false : true;
  };

  //returns a promise object with exposed resolve and reject handles
  //this is used to let the canvas update loop resolve a promise created by the AlgXSearch executor
  const getExposedPromise = (): any => {
    let res, rej, promise: any;
    promise = new Promise((_res, _rej) => {
      res = _res;
      rej = _rej;
    });
    promise.resolve = res;
    promise.reject = rej;
    return promise;
  };

  return(
    <div>
      <div>
        <button onClick={solveCB}> solve </button>
        <button onClick={testCB}> test </button>
        <button onClick={stepCB}> step </button>
        <button onClick={enableStepModeCB}> stepMode </button>
      </div>
      <canvas ref={canvas} width={getWidth()} height={getHeight()}/>
    </div>
  );
}


export { AlgXAnimator, NodeDrawInfo, LinkDrawInfo };
