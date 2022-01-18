import React from "react";
import {Tooltip} from "./generic_elements";
import {translateIEItem, upperCaseName} from "./localization";
import {getRecipePath, MOD_ID} from "./resources";

const SPECIAL_ELEMENT_HEIGHTS = {
    crafting: (e) => 'recipe' in e ? 8 : 'recipes' in e ? 8 * e['recipes'].length : 1,
    item_display: (e) => 4,
};

export function loadSpecialElement(branch, element) {
    // normal recipes
    if (element['type'] === 'crafting') {
        //single recipe
        if (element['recipe'])
            return Recipe.loadRecipe(branch, element['recipe']);
        //multiple recipes
        else if (element['recipes']) {
            let recipes = element['recipes'];
            return Promise.all(recipes.map(recipe => {
                if (Array.isArray(recipe))
                    return MultiRecipe.parseMultiRecipe(branch, recipe);
                else
                    return Recipe.loadRecipe(branch, recipe);
            }));
        }
    }
    // item displays look very silly without textures
    if (element['type'] === 'item_display') {
        return Promise.resolve(
        <div className="item_display">
            {element['item'] ? <Ingredient symbol={'Item'} value={element['item']}/>
                : element['items'] ? element['items'].map(item => <Ingredient symbol={'Item'} value={item}/>)
                    : null
            }
        </div>);
    }
    return new Promise((resolve, reject) => resolve(null));
}

export function getSpecialHeight(element) {
    if (!element)
        return 0;
    let type = element['type'] || '';
    if (!(type in SPECIAL_ELEMENT_HEIGHTS))
        return 0;
    return SPECIAL_ELEMENT_HEIGHTS[type](element) || 0;
}

function ingredientTooltip(ingredient) {
    if (ingredient['tag'])
        return (<>
            <span>Tag:</span><br/>
            <span>{ingredient['tag']}</span>
        </>);
    else if (ingredient['item']) {
        let split = ingredient['item'].split(':');
        let domain = split.length > 1 ? split[0] : MOD_ID;
        let name = split[split.length > 1 ? 1 : 0];
        if (domain === MOD_ID) {
            name = translateIEItem(name);
            domain = 'Immersive Engineering';
        } else {
            domain = upperCaseName(domain);
            name = upperCaseName(name);
        }
        return (<>
            <span>{name}</span><br/>
            <span className="domain formatting_o">{domain}</span>
        </>);
    }
    return '';
}


class Recipe extends React.Component {
    constructor(props) {
        super(props);
    }

    render() {
        if (this.props.data['pattern'])
            return Recipe.buildShapedRecipe(this.props.name, this.props.data);
        else if (this.props.data['ingredients'])
            return Recipe.buildShapelessRecipe(this.props.name, this.props.data);
    }

    static loadRecipeFromElement(branch, element) {
        if (typeof element === 'string')
            return Recipe.loadRecipe(branch, element);
        else if (typeof element === 'object' && 'recipe' in element)
            return Recipe.loadRecipe(branch, element['recipe']);
        return null;
    }

    static loadRecipe(branch, key) {
        return fetch(`${getRecipePath(branch)}${key}.json`)
            .then(res => res.json())
            .then(out => <Recipe name={key} data={out}/>);
    }

    static buildShapedRecipe(name, data) {
        let patternFlat = data.pattern.join('').split('');
        return (
            <div className="recipe" name={name}>
                <div className={'grid col' + data.pattern[0].length}>
                    {patternFlat.map((c, i) => <Ingredient key={i} symbol={c} value={data.key[c]}/>)}
                </div>
                <div className="arrow"/>
                <div className="output">
                    <Ingredient symbol={'?'} value={data.result}/>
                </div>
            </div>
        );
    }

    static buildShapelessRecipe(name, data) {
        let cols = data.ingredients.length === 1 ? 1 : data.ingredients.length < 5 ? 2 : 3;
        return (
            <div className="recipe" name={name}>
                <div className={'grid col' + cols}>
                    {data.ingredients.map((e, i) => <Ingredient key={i} symbol={i} value={e}/>)}
                </div>
                <div className="arrow"/>
                <div className="output">
                    <Ingredient symbol={'?'} value={data.result}/>
                </div>
            </div>
        );
    }
}

class MultiRecipe extends React.Component {
    constructor(props) {
        super(props);
        this.state = {recipeIdx: 0};
    }

    static parseMultiRecipe(branch, array) {
        return Promise.all(array.map(o => Recipe.loadRecipeFromElement(branch, o)).filter(r => r != null))
            .then(recipes => <MultiRecipe recipes={recipes}/>);
    }

    render() {
        return <div className="multi_recipe">
            <button
                className={"recipe_prev" + (this.state.recipeIdx > 0 ? '' : ' off')}
                onClick={() => this.setState({recipeIdx: this.state.recipeIdx - 1})}/>
            {this.props.recipes[this.state.recipeIdx]}
            <button
                className={"recipe_next" + (this.state.recipeIdx < this.props.recipes.length - 1 ? '' : ' off')}
                onClick={() => this.setState({recipeIdx: this.state.recipeIdx + 1})}/>
        </div>;
    }
}


function Ingredient(props) {
    let ingredient = props['value'];
    let present = ingredient && (ingredient['item'] || ingredient['tag']);
    if (!present)
        return <div className="item empty"/>;
    else {
        return <div className="item" onMouseMove={
            event => {
                let tooltip = event.currentTarget.querySelector('.tooltip');
                if(tooltip) {
                    tooltip.style.position = 'fixed';
                    tooltip.style.top = `calc(${event.clientY}px + 2vmin)`;
                    tooltip.style.left = event.clientX+'px';
                }
            }
        }>
            <span className="symbol">{props.symbol}</span>
            {ingredient['count'] && <span className="count">{ingredient['count']}</span>}
            <Tooltip text={ingredientTooltip(ingredient)}/>
        </div>;
    }
}
