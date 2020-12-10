queue()
    .defer(d3.csv, "data/salaries.csv")
    .await(makeGraphs);

function makeGraphs(error, salaryData) {
    var ndx = crossfilter(salaryData);

    salaryData.forEach(function (d) {
        d.salary = parseInt(d.salary);
        d.yrs_since_phd = parseInt(d["yrs.since.phd"]);
        d.yrs_service = parseInt(d["yrs.service"]);
    });
    show_discipline_selector(ndx);
    show_percent_that_are_professors(ndx, "Female", "#percent-of-women-professors");
    show_percent_that_are_professors(ndx, "Male", "#percent-of-men-professors");
    show_gender_balance(ndx);
    show_average_salaries(ndx);
    show_rank_distribution(ndx);
    show_service_to_salary_correlation(ndx);
    show_phd_to_salary_correlation(ndx);
    dc.renderAll();
};


//----- DISCIPLINE SELECTOR
function show_discipline_selector(ndx) {
    dim = ndx.dimension(dc.pluck("discipline"));
    group = dim.group()
    dc.selectMenu("#discipline-selector")
        .dimension(dim)
        .group(group);
};


//----- PERCENTAGE OF PROFESSORS BY GENDER
function show_percent_that_are_professors(ndx, gender, element) {
    var percentageThatAreProf = ndx.groupAll().reduce(
        function (p, v) {
            if (v.sex === gender) {
                p.count++;
                if (v.rank === "Prof") {
                    p.are_prof++;
                }
            }
            return p;
        },
        function (p, v) {
            if (v.sex === gender) {
                p.count--;
                if (v.rank === "Prof") {
                    p.are_prof--;
                }
            }
            return p;
        },
        function () {
            return {
                count: 0,
                are_prof: 0
            };
        }
    );
    dc.numberDisplay(element)
        .formatNumber(d3.format(".2%"))
        .valueAccessor(function (d) {
            if (d.count == 0) {
                return 0;
            } else {
                return (d.are_prof / d.count);
            }
        })
        .group(percentageThatAreProf)
        .useViewBoxResizing(true)
        .transitionDuration(1000)
        .transitionDelay(500);
};


//----- GENDER BALANCE
function show_gender_balance(ndx) {
    var dim = ndx.dimension(dc.pluck("sex"));
    var group = dim.group();
    dc.barChart("#gender-balance")
        .width(350)
        .height(250)
        .margins({
            top: 0,
            right: 0,
            bottom: 40,
            left: 40
        })
        //.useViewBoxResizing(true)
        .dimension(dim)
        .group(group)
        .transitionDuration(500)
        .transitionDelay(500)
        .x(d3.scale.ordinal())
        .xUnits(dc.units.ordinal)
        .gap(10)
        .renderHorizontalGridLines(true)
        .xAxisLabel("Gender")
        .yAxisLabel("Total")
        .yAxis().ticks(10);
};


//----- AVERAGE SALARY BY GENDER
function show_average_salaries(ndx) {
    var dim = ndx.dimension(dc.pluck("sex"));

    function add_item(p, v) {
        p.count++;
        p.total += v.salary;
        p.average = p.total / p.count;
        return p;
    };

    function remove_item(p, v) {
        p.count--;
        if (p.count == 0) {
            p.total = 0;
            p.average = 0;
        } else {
            p.total -= v.salary;
            p.average = p.total / p.count;
        }
        return p;
    };

    function initialize() {
        return {
            count: 0,
            total: 0,
            average: 0
        };
    };
    var averageSalaryByGender = dim.group().reduce(add_item, remove_item, initialize);

    dc.barChart("#average-salary")
        .width(350)
        .height(250)
        .margins({
            top: 0,
            right: 0,
            bottom: 40,
            left: 50
        })
        //.useViewBoxResizing(true)
        .dimension(dim)
        .group(averageSalaryByGender)
        .valueAccessor(function (d) {
            return d.value.average.toFixed(2);
        })
        .transitionDuration(500)
        .transitionDelay(500)
        .x(d3.scale.ordinal())
        .xUnits(dc.units.ordinal)
        //.elasticY(true)
        .gap(10)
        .renderHorizontalGridLines(true)
        .xAxisLabel("Gender")
        .yAxisLabel("Salary ($)")
        .yAxis().ticks(5);
};


//----- RANK DISTRIBUTION BY GENDER
function show_rank_distribution(ndx) {
    function rankByGender(dimension, rank) {
        return dimension.group().reduce(
            function (p, v) {
                p.total++;
                if (v.rank == rank) {
                    p.match++;
                }
                return p;
            },
            function (p, v) {
                p.total--;
                if (v.rank == rank) {
                    p.match--;
                }
                return p;
            },
            function () {
                return {
                    total: 0,
                    match: 0
                };
            }
        );
    };
    var dim = ndx.dimension(dc.pluck("sex"));
    var profByGender = rankByGender(dim, "Prof");
    var asstProfByGender = rankByGender(dim, "AsstProf");
    var assocProfByGender = rankByGender(dim, "AssocProf");

    dc.barChart("#rank-distribution")
        .width(350)
        .height(250)
        .margins({
            top: 0,
            right: 100,
            bottom: 30,
            left: 30
        })
        //.useViewBoxResizing(true)
        .transitionDuration(500)
        .transitionDelay(850)
        .dimension(dim)
        .gap(10)
        .renderHorizontalGridLines(true)
        .group(profByGender, " - Prof")
        .stack(asstProfByGender, " - Asst Prof")
        .stack(assocProfByGender, " - Assoc Prof")
        .valueAccessor(function (d) {
            if (d.value.total > 0) {
                return (d.value.match / d.value.total).toFixed(2) * 100;
            } else {
                return 0;
            }
        })
        .x(d3.scale.ordinal())
        .xUnits(dc.units.ordinal)
        .xAxisLabel("Gender")
        .yAxisLabel("Staff (%)")
        .legend(dc.legend().x(260).y(5).itemHeight(20).gap(10))
        .yAxis().ticks(10);
};


//----- SALARY CORRELATION TO YEARS OF SERVICE
function show_service_to_salary_correlation(ndx) {
    var genderColors = d3.scale.ordinal()
        .domain(["Female", "Male"])
        .range(["salmon", "cornflowerblue"]);
    var eDim = ndx.dimension(dc.pluck("yrs_service"));
    var experienceDim = ndx.dimension(function(d) {
        return [d.yrs_service, d.salary, d.rank, d.sex];
    });
    var experienceSalaryGroup = experienceDim.group();
    var minExperience = eDim.bottom(1)[0].yrs_service;
    var maxExperience = eDim.top(1)[0].yrs_service;

    dc.scatterPlot("#service-salary")
        .width(900)
        .height(300)
        .margins({
            top: 10,
            right: 10,
            bottom: 40,
            left: 60
        })
        .x(d3.scale.linear().domain([minExperience, maxExperience]))
        .brushOn(false)
        .symbolSize(5)
        .clipPadding(10)
        .useViewBoxResizing(true)
        .transitionDuration(1000)
        .transitionDelay(500)
        .renderHorizontalGridLines(true)
        .renderVerticalGridLines(true)
        .xAxisLabel("Years of Service")
        .yAxisLabel("Salary ($)")
        .title(function(d) {
            return d.key[2] + " earned: $" + d.key[1].toFixed(2);
        })
        .colorAccessor(function(d) {
            return d.key[3];
        })
        .colors(genderColors)
        .dimension(experienceDim)
        .group(experienceSalaryGroup)
        .yAxis().ticks(10);
};


//----- PhD CORRELATION TO YEARS OF SERVICE
function show_phd_to_salary_correlation(ndx) {
    var genderColors = d3.scale.ordinal()
        .domain(["Female", "Male"])
        .range(["salmon", "cornflowerblue"]);
    var pDim = ndx.dimension(dc.pluck("yrs_since_phd"));
    var phdDim = ndx.dimension(function(d) {
        return [d.yrs_since_phd, d.salary, d.rank, d.sex];
    });
    var phdSalaryGroup = phdDim.group();
    var minPhd = pDim.bottom(1)[0].yrs_since_phd;
    var maxPhd = pDim.top(1)[0].yrs_since_phd;

    dc.scatterPlot("#phd-salary")
        .width(900)
        .height(300)
        .margins({
            top: 10,
            right: 10,
            bottom: 40,
            left: 60
        })
        .x(d3.scale.linear().domain([minPhd, maxPhd]))
        .brushOn(false)
        .symbolSize(5)
        .clipPadding(10)
        .useViewBoxResizing(true)
        .transitionDuration(1000)
        .transitionDelay(500)
        .renderHorizontalGridLines(true)
        .renderVerticalGridLines(true)
        .xAxisLabel("Years since PhD")
        .yAxisLabel("Salary ($)")
        .title(function(d) {
            return d.key[2] + " earned: $" + d.key[1].toFixed(2);
        })
        .colorAccessor(function(d) {
            return d.key[3];
        })
        .colors(genderColors)
        .dimension(phdDim)
        .group(phdSalaryGroup)
        .yAxis().ticks(10);
};