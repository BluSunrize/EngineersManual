import React from "react";
import {translate} from "./localization";
import {getSpecialHeight, loadSpecialElement} from "./special_elements";
import {elementHasClass, reactSetStateWrapper} from "./resources";
import {Link} from "react-router-dom";

let last_tooltip = null;

export class Tooltip extends React.Component {
    render() {
        return <div className="tooltip">
            {this.props.text}
        </div>;
    }

    static findAndShowTooltip(start) {
        let tooltip = start.nextSibling;
        if (!elementHasClass(tooltip, 'tooltip')) {
            if (elementHasClass(start, 'item'))
                tooltip = start.querySelector('.tooltip');
            else if (elementHasClass(start.parent, 'item'))
                tooltip = start.parent.querySelector('.tooltip');
        }
        if (last_tooltip)
            last_tooltip.style.display = 'none';
        if (!elementHasClass(tooltip, 'tooltip'))
            return;
        tooltip.style.display = 'block';
        last_tooltip = tooltip;
    }
}

export function ManualLink(props) {
    return (
        <Link className="text-link" to={props.link + (props.anchor ? ('?' + props.anchor) : '')}>
            {props.text}
        </Link>
    )
}

export function Formatting(props) {
    return <span className={'formatting_' + props.format}>{props.text}</span>;
}

export class Anchor extends React.Component {
    static make(name, branch, data) {
        data = data[name]
        if (Array.isArray(data))
            return data.map((entry, i) =>
                <Anchor key={name + '_' + i} anchor={name} branch={branch} data={entry}
                        height={getSpecialHeight(entry)}/>
            );
        return <Anchor key={name} anchor={name} branch={branch} data={data} height={getSpecialHeight(data)}/>;
    }

    constructor(props) {
        super(props);
        this.state = {
            element: null,
            loaded: false
        };

        const loadSpecial = (branch, data) => {
            loadSpecialElement(branch, data).then(res => {
                if (res)
                    reactSetStateWrapper(this, {element: res});
            })
        };
        if (this.props.data)
            loadSpecial(this.props.branch, this.props.data);
    }


    componentDidMount() {
        this.setState({
            loaded: true
        });
    }

    render() {
        return <span className="anchor" key={this.props.anchor}>
            {this.state.element || ''}
        </span>;
    }
}


export function PageBreak(props) {
    return null;
}

export function KeyBind(props) {
    return <span className="keybind">{translate(props.keybind)}</span>;
}

export function ConfigInt(props) {
    return (
        <>
            <span className="config int tooltip-hider">???</span>
            <Tooltip text={translate('tooltip.config.int', props.cfg)}/>
        </>
    );
}

export function ConfigIntArray(props) {
    return (
        <>
            <span className="config int-array tooltip-hider">?, ?, ?</span>
            <Tooltip text={translate('tooltip.config.array', props.cfg)}/>
        </>
    );
}

export class ConfigBool extends React.Component {
    constructor(props) {
        super(props);
        this.state = {option: 0};
    }

    handleClick() {
        this.setState(prevState => ({option: prevState.option === 1 ? 0 : 1}));
    }

    render() {
        return (<>
            <span className="config-helper tooltip-hider" onClick={() => this.handleClick()}>?</span>
            <Tooltip text={translate('tooltip.config.boolean', this.props.cfg)}/>
            <span className="config bool" title={translate(this.props.cfg)}>{this.props.text[this.state.option]}</span>
        </>);
    }
}

export class SelectDropdown extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            value: props.defaultValue || '',
            foldOut: false
        };
    }

    render() {
        return <div className="select-dropdown">
            {this.props.label && <label className="select-label">{this.props.label}</label>}
            <div className={'select-header' + (this.state.foldOut ? ' active' : '')}
                 onClick={() => this.setState({foldOut: !this.state.foldOut})}>
                {this.state.value}
            </div>
            <ul className="select-options">
                {this.props.options.map(op =>
                    <li key={op} value={op} onClick={(event) => {
                        let val = event.target.getAttribute('value');
                        this.setState({
                            value: val,
                            foldOut: false,
                        });
                        this.props.onChange && this.props.onChange(val);
                    }}>{op}</li>)
                }
            </ul>
        </div>
    }
}