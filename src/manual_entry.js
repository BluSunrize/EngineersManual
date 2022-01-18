import React from "react";
import reactStringReplace from "react-string-replace";
import {Anchor, ConfigBool, ConfigInt, ConfigIntArray, KeyBind, ManualLink, PageBreak} from "./generic_elements";
import {getSpecialHeight, loadSpecialElement} from "./special_elements";
import {DEFAULT_BRANCH, reactSetStateWrapper} from "./resources";
import {verifyEntryExists} from "./App";
import {useParams} from "react-router-dom";
import {DEFAULT_LANGUAGE} from "./localization";

const re_anchor = /<&(\w+)>/g;
const re_link = /<link;(\w+);([^;]*?)(?:;(\w*))?>/g;
const re_keybind = /<keybind;([\w.]+)>/g;
const re_formatting = /§([^r])(.+?)§r/g;

const re_config_int = /<config;i;([^;]+)>/g
const re_config_bool = /<config;b;([^;]+);([^;]+);([^;]*)>/g
const re_config_int_array = /<config;iA;([^;]+)(?:;([^;]*))?>/g

function replaceJSX(input, pattern, fn) {
    if (input instanceof Array)
        for (let i in input)
            input[i] = replaceJSX(input[i], pattern, fn)
    else if (typeof input === "string")
        for (let match of input.matchAll(pattern)) {
            let rep = fn(...match);
            input = reactStringReplace(input, match[0], () => rep);
        }
    return input;
}

function isReactElement(element, ...types) {
    if (!React.isValidElement(element))
        return false;
    if (types.length > 0)
        return types.map(t => t.name).includes(element.type.name);
    return true;
}

const MAX_LINES = 19;

export class ManualEntry extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            page: 0,
            pages: [],
            loaded: false
        };

        const loadEntry = async () => {
            let pages = [];

            let formatted = this.handleReplacements(this.props.text, this.props.data);
            if (typeof formatted === 'string')
                // rare case of a pure text entry
                formatted = [formatted]
            else
                // if we have a nesting greater than 100, we did something wrong
                formatted = formatted.flat(100).filter(e => e !== '');

            // add a start anchor, if missing
            if (!isReactElement(formatted[0], Anchor))
                formatted.unshift(Anchor.make('start', this.props.branch, this.props.data));

            console.log('entry flattened and ready, ', formatted);

            // split at the pagebreaks
            let last = 0;
            let length = 0;
            for (let i = 0; i < formatted.length; i++) {
                let isBreak = isReactElement(formatted[i], PageBreak, Anchor);
                let hasSpliced = false;
                if (!isBreak) {
                    // check if we can fit the whole piece
                    let lines = null;
                    let lengthL = 1;
                    // if it's a string, split it into lines
                    if (typeof formatted[i] === 'string') {
                        lines = formatted[i].match(/.{1,30}(\s|$)/g);
                        lengthL = formatted[i].length < 3 ? 0 : lines.length;
                    }

                    if (length + lengthL > MAX_LINES) {
                        // if it's multiple lines, try partial fit
                        if (lines && lines.length > 1) {
                            let willFit = lines.slice(0, MAX_LINES - length);
                            let wontFit = lines.slice(MAX_LINES - length);
                            formatted.splice(i, 1, willFit.join(''), wontFit.join(''));
                            hasSpliced = true;
                            i++;
                        }
                        isBreak = true;
                    }
                    length += lengthL;
                }


                if (isBreak) {
                    pages.push(formatted.slice(last, i))
                    if (isReactElement(formatted[i], PageBreak))
                        last = i + 1
                    else
                        last = i;
                    length = 0;
                    if (isReactElement(formatted[i], Anchor))
                        length = formatted[i].props.height;

                    if (hasSpliced)
                        i--;
                }
            }
            // add the rest
            pages.push(formatted.slice(last, formatted.length))

            console.log('prepped pages', pages);

            // filter out empties
            pages = pages.filter(p => p.length > 0).map(p => <div className="pagecontent">{p}</div>);

            reactSetStateWrapper(this, {pages: pages});
        }
        loadEntry();
    }

    handleReplacements(input, data) {
        // remove pagebreaks (and trailing newlines)
        input = replaceJSX(input, /<np>(\n)*/g, () => <PageBreak/>);

        // replace all links
        input = replaceJSX(input, re_link, (match, link, text, anchor) => {
            verifyEntryExists(this.props.branch, this.props.lang, link);
            return <ManualLink key={link+'?'+anchor} link={link} anchor={anchor} text={this.handleReplacements(text)}/>;
        });

        // replace all instances of formatting with nested spans
        input = replaceJSX(input, re_formatting, (match, format, text) => {
            return <><span className={'formatting_' + format}>{this.handleReplacements(text + '§r')}</span></>;
        });

        // replace all integer config values
        input = replaceJSX(input, re_config_int, (match, cfg) => <ConfigInt cfg={cfg}/>);

        // replace all boolean config values
        input = replaceJSX(input, re_config_bool, (match, cfg, on, off) => <ConfigBool cfg={cfg} text={[on, off]}/>);

        // replace all integer config values
        input = replaceJSX(input, re_config_int_array, (match, cfg) => <ConfigIntArray cfg={cfg}/>);

        // mark the anchors as pagebreaks
        input = replaceJSX(input, re_anchor, (match, anchor) => Anchor.make(anchor, this.props.branch, data));

        // replace all keybinds
        input = replaceJSX(input, re_keybind, (match, bind) => <KeyBind keybind={bind}/>);

        // replace all linebreaks
        input = replaceJSX(input, /(\n)|(\\n)|(<br>)/g, () => <br/>);

        // remove leftover format resetters
        input = replaceJSX(input, '§r', () => null);

        return input;
    }


    componentDidMount() {
        this.setState({
            loaded: true
        });
    }

    setPage(page) {
        this.setState({
            page: page
        })
    }

    render() {
        return this.state.loaded ? (
            <>
                <h2>{this.props.title}</h2>
                <h3>{this.props.subtitle}</h3>
                <div key={this.props.text} className="page">
                    {this.state.pages[this.state.page]}
                </div>
                <footer>
                    <button
                        className={"page_prev" + (this.state.page > 0 ? '' : ' off')}
                        onClick={() => this.setPage(this.state.page - 1)}/>
                    <button
                        className={"page_next" + (this.state.page < this.state.pages.length - 1 ? '' : ' off')}
                        onClick={() => this.setPage(this.state.page + 1)}/>
                </footer>
            </>
        ) : <span>Page is loading, please wait</span>;
    }

}