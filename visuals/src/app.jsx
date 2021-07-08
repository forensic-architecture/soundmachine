import ReactDOM from "react-dom";
import "./style.css";
import Visualization from "./Visualization";

const App = () => {
  return (
    <>
      <Visualization />
    </>
  );
};

ReactDOM.render(<App />, document.getElementById("root"));
